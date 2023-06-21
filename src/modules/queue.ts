type queueType = {
    isRunning: boolean
    transaction: any[]
    maxRolls: number
    failed: any[]
    succeeded: any[]
    method: {
        handler(arg: any): Promise<void>
        rejected(arg: any, error: unknown): void
        resolved(arg: any, result: unknown): void
        end(resolved: any[], rejected: any[]): void
    }
}

const storage = {} as {
    [propName: string]: queueType
}

const executeQueue = (name: string): void => {
    const queue = storage[name] as queueType
    const { transaction, method, failed, succeeded } = queue
    const { handler, rejected, resolved } = method
    const item = transaction[0]

    queue.isRunning = true

    handler(item)
        .then(
            (result: unknown) => {
                resolved(item, result)
                succeeded.push(item)
                transaction.shift()
            },
            (error: unknown) => {
                queue.maxRolls -= 1
                if (queue.maxRolls === 0) {
                    rejected(item, error)
                    failed.push(item)
                    transaction.shift()
                    queue.maxRolls = queueManager.maxRolls
                }
            }
        )
        .finally(() => {
            if (transaction.length) {
                if (queue.maxRolls === 3) {
                    setTimeout(() => executeQueue(name), 0)
                } else {
                    setTimeout(() => executeQueue(name), queueManager.restartTime)
                }
            } else {
                method.end(succeeded, failed)
                queue.succeeded = []
                queue.failed = []
                queue.isRunning = false
            }
        })
}

const queueManager = {
    restartTime: 300,
    maxRolls: 3,
    addQueue(name: string, method: queueType['method']): void {
        storage[name] = {
            isRunning: false,
            transaction: [],
            failed: [],
            succeeded: [],
            maxRolls: this.maxRolls,
            method
        }
    },
    startQueue(name: string, args: any[]): void {
        const queue = storage[name] as queueType

        queue.transaction.push(...args)

        if (!queue.isRunning) {
            executeQueue(name)
        }
    }
}

export default queueManager
