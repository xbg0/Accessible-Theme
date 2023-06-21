type eventType = { defaultArgs?: any; method(...arg: any): any }

const storage = {
} as {
    [eventName: string]: eventType
}

const eventManager = {
    executeEvent(event: string, ...args: any): void {
        const { defaultArgs, method } = storage[event] as eventType
        if (defaultArgs) {
            method(defaultArgs, ...args)
        } else {
            method(...args)
        }
    },
    addEvent(event: string, options: eventType) {
        storage[event] = options
        return this
    }
}

export default eventManager
