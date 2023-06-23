type listenerType<T> = {
    status: { item: T; callback: (...args: any) => void }[]
    register(item: string, callback: (...args: any) => void): void
}

export const addListener = <T>({ status, register }: listenerType<T>) => {
    for (const { item, callback } of status) {
        register(item as string, callback)
    }
}
