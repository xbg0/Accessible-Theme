import { getContext } from './controller'

export const getCache = (key: string): string | undefined => {
    return getContext().globalState.get(key)
}

export const updateCache = (key: string, value?: string): Thenable<void> => {
    return getContext().globalState.update(key, value)
}

export const updateCacheWithMap = (
    key: string,
    map: Map<string, any>
): Thenable<void> => {
    const cache = getCache(key)
    const cacheMap: Map<string, any> = new Map(cache && JSON.parse(cache))

    for (const [section, value] of map) {
        if (value === undefined) {
            cacheMap.delete(section)
        } else {
            cacheMap.set(section, value)
        }
    }

    return updateCache(key, JSON.stringify([...cacheMap]))
}
