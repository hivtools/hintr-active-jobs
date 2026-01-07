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

export async function getActiveJobs(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

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

        // 3. Get the length of the queue
        const keyQueue = "hintr:queue:" + queueName;
        const queueLength = await redis.llen(keyQueue);

        return {
            status: 200,
            body: JSON.stringify(queueLength),
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
