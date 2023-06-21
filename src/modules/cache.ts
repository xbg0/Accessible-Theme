import controller from './controller'

const cacheManager = {
    getCache(key: string): string | undefined {
        return controller.getContext().globalState.get(key)
    },
    updateCache(key: string, value?: string): Thenable<void> {
        return controller.getContext().globalState.update(key, value)
    },
    updateCacheWithMap(key: string, map: Map<string, any>): Thenable<void> {
        const cache = this.getCache(key)
        const cacheMap: Map<string, any> = new Map(cache && JSON.parse(cache))

        for (const [section, value] of map) {
            if (value === undefined) {
                cacheMap.delete(section)
            } else {
                cacheMap.set(section, value)
            }
        }

        return this.updateCache(key, JSON.stringify([...cacheMap]))
    }
}

export default cacheManager
