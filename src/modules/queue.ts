type queueType = {
    isRunning: boolean
    maxRolls: number
    transaction: any[]
    succeeded: any[]
    failed: any[]
    method: queueMethodType
}
type queueMethodType = {
    handler(item: any): Promise<void>
    rejected(error: unknown, item: any): void
    resolved(result: unknown, item: any): void
    end(resolved: any[], rejected: any[]): void
}

const restartTime = 300
const maxRolls = 3
const storage: {
    [propName: string]: queueType
} = {}

const handleQueue = (
    item: any,
    handler: queueMethodType['handler'],
    resolve: (result: unknown) => void,
    rejecte: (error: unknown) => void,
    _finally: () => void,
    delay: number = 0
) => {
    setTimeout(() => handler(item).then(resolve, rejecte).finally(_finally), delay)
}

const executeQueue = (queue: queueType) => {
    const { transaction, method, failed, succeeded } = queue
    const { handler, rejected, resolved } = method
    const resolve = (result: unknown) => {
        const item = transaction[0]
        resolved(result, item)
        succeeded.push(item)
        transaction.shift()
    }
    const rejecte = (error: unknown) => {
        queue.maxRolls -= 1
        if (queue.maxRolls === 0) {
            const item = transaction[0]
            rejected(error, item)
            failed.push(item)
            queue.maxRolls = maxRolls
            transaction.shift()
        }
    }
    const _finally = () => {
        if (transaction.length) {
            const item = transaction[0]
            if (queue.maxRolls === maxRolls) {
                return handleQueue(item, handler, resolve, rejecte, _finally)
            } else {
                return handleQueue(
                    item,
                    handler,
                    resolve,
                    rejecte,
                    _finally,
                    restartTime
                )
            }
        } else {
            method.end(succeeded, failed)
            resetQueue(queue)
        }
    }

    handleQueue(transaction[0], handler, resolve, rejecte, _finally)
}

const resetQueue = (queue: queueType) => {
    queue.isRunning = false
    queue.maxRolls = maxRolls
    queue.succeeded = []
    queue.failed = []
}

export const addQueue = (name: string, method: queueMethodType) => {
    storage[name] = {
        isRunning: false,
        maxRolls: maxRolls,
        transaction: [],
        succeeded: [],
        failed: [],
        method,
    }
}

export const startQueue = (name: string, args: any[]) => {
    const queue = storage[name]

    queue.transaction.push(...args)

    if (!queue.isRunning) {
        queue.isRunning = true
        executeQueue(queue)
    }
}
