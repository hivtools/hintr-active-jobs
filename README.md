# hintr-active-jobs

This repo contains an Azure function app which gets the number of "active" jobs from [rrq](https://github.com/mrc-ide/rrq). We need this for scaling containers dynamically. "active" jobs are those which are either running or waiting to be run i.e. any with a non-terminal state.

We need this for a few reasons but mainly azure container apps will scale using KEDA. KEDA can monitor a redis list (the rrq queue) but the queue immediately removes jobs when they start but KEDA expects jobs to only be removed when they finish. So we need this to give us the correct number.

## Development

Add instructions of how to push and modify this
