type eventType = { defaultArgs?: any; method(...arg: any): void }

const storage: {
    [eventName: string]: eventType
} = {}

export const executeEvent = (event: string, ...args: any) => {
    const { defaultArgs, method } = storage[event] as eventType
    if (defaultArgs) {
        method(defaultArgs, ...args)
    } else {
        method(...args)
    }
}

export const addEvent = (event: string, options: eventType) => {
    storage[event] = options
}
