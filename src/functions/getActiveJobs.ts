import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import Redis from "ioredis";

// Initialize Redis client
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
    if (!redisClient) {
        const redisConnectionString = process.env.REDIS_CONNECTION_STRING;

        if (!redisConnectionString) {
            throw new Error("REDIS_CONNECTION_STRING environment variable is not set");
        }

        redisClient = new Redis(redisConnectionString);
    }

    return redisClient;
}

const GET_QUEUE_STATS_SCRIPT = `
local prefix = 'hintr:'
local queue_name = KEYS[1]

-- Get pending jobs in queue
local queue_length = redis.call('LLEN', prefix .. 'queue:' .. queue_name)

-- Get all worker IDs for this queue
local worker_ids = redis.call('SMEMBERS', prefix .. 'worker:id')

-- Count workers with active tasks
local active_count = 0
for _, worker_id in ipairs(worker_ids) do
    local task = redis.call('HGET', prefix .. 'worker:task', worker_id)
    if task then
        active_count = active_count + 1
    end
end

return {queue_length, active_count}
`;

export async function getActiveJobs(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        // 1. Validate queue name
        const queueName = request.query.get('queue');

        if (!queueName) {
            return {
                status: 400,
                body: JSON.stringify({
                    error: "Queue name is required. Please provide 'queue' query parameter."
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        }

        // 2. Establish Redis connection
        const redis = getRedisClient();

        // 3. Execute Lua script to get queue stats atomically
        const result = await redis.eval(
            GET_QUEUE_STATS_SCRIPT,
            1, // number of keys
            queueName // KEYS[1]
        ) as [number, number];

        const [queueLength, activeWorkers] = result;
        const totalJobs = queueLength + activeWorkers;

        return {
            status: 200,
            body: JSON.stringify(
                {
                    'activeJobs': totalJobs
                }
            ),
            headers: {
                'Content-Type': 'application/json'
            }
        };

    } catch (error) {
        context.error(`Error processing request: ${error}`);

        return {
            status: 500,
            body: JSON.stringify({
                error: "Internal server error",
                message: error instanceof Error ? error.message : "Unknown error"
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }
};

app.http('getActiveJobs', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: getActiveJobs
});
