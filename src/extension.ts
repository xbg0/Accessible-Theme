import { isDeepStrictEqual } from 'util'
import * as vscode from 'vscode'

function isEqualArray(item1: any[], item2: any[]) {
    if (item1.length !== item2.length) return false

    // let left = 0, right = item1.length
    // for (; left < right; ) {
    //     const leftValue = item1[left]
    //     const rightValue = item2[right]
    //     if (isEqual(leftValue, rightValue)) {
    //         i++
    //         return false
    //     } else {

    //     }
    // }
}

function isEqual(item1: any, item2: any): boolean {
    if (item1 === item2) return true
    if (Array.isArray(item1) && Array.isArray(item2)) {
        let i = 0
        for (const value of item1) {
            if (!isEqual(value, item2[i++])) {
                return false
            }
        }
        return true
    }

    return false
}

const cacheManager = {
    operator: {} as vscode.Memento,
    getCache(key: string): string | undefined {
        return this.operator.get(key)
    },
    updateCache(key: string, value?: string): Thenable<void> {
        return this.operator.update(key, value)
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
    },
    initialize(context: vscode.ExtensionContext) {
        this.operator = context.globalState
    }
}

type eventType = { defaultArgs?: any; method(args?: any): void | Promise<void> }

const eventManager = {
    storage: new Map() as Map<string, eventType>,
    register(events: { [propName: string]: eventType }): void {
        for (const key in events) {
            this.storage.set(key, events[key])
        }
    },
    execute(event: string, args?: any, callback?: () => void): void {
        const { defaultArgs, method } = this.storage.get(event) as eventType
        const result = method(args || defaultArgs)

        // if (callback) {
        //     if (result instanceof Promise) {
        //         result.finally(callback)
        //     } else {
        //         callback()
        //     }
        // }
    },
    initialize(): void {
        this.register({
            mergeUserConfiguration: {
                method({ item, configurationIndex }) {
                    const cache = cacheManager.getCache(item)
                    const cacheConfiguration: Map<string, any> = new Map(cache && JSON.parse(cache))
                    const configuration = configurationManager.getCustomConfiguration(configurationIndex)
                    const changes = new Map()

                    for (const [key, value] of configuration) {
                        if (cacheConfiguration.has(key)) {
                            const cacheValue = cacheConfiguration.get(key)
                            if (value !== cacheValue && configurationManager.getUserConfiguration(key) === cacheValue) {
                                changes.set(key, value)
                                cacheConfiguration.set(key, value)
                            }
                        } else {
                            if (configurationManager.checkConfigurationIsDefault(key)) {
                                changes.set(key, value)
                                cacheConfiguration.set(key, value)
                            }
                        }
                    }

                    for (const [key, value] of cacheConfiguration) {
                        if (!configuration.has(key)) {
                            if (configurationManager.getUserConfiguration(key) === value) {
                                changes.set(key, undefined)
                            }
                            cacheConfiguration.delete(key)
                        }
                    }

                    if (changes.size > 0) {
                    }
                }
            },
            mergeUserConfiguration2: {
                method({ item, configurationIndex }) {
                    const cache = cacheManager.getCache(item)
                    const cacheConfiguration: Map<string, any> = new Map(cache && JSON.parse(cache))
                    const configuration = configurationManager.getCustomConfiguration(configurationIndex)
                    const changes: object[] = []

                    for (const [section, value] of configuration) {
                        const userConfigurationValue = configurationManager.getUserConfiguration(section)
                        const cacheConfigurationValue = cacheConfiguration.get(section)
                        if (
                            userConfigurationValue === undefined ||
                            (!isDeepStrictEqual(cacheConfigurationValue, value) && isDeepStrictEqual(userConfigurationValue, cacheConfigurationValue))
                        ) {
                            changes.push({ item, section, value })
                        }
                    }

                    for (const [section, value] of cacheConfiguration) {
                        if (!configuration.has(section) && isDeepStrictEqual(value, configurationManager.getUserConfiguration(section))) {
                            changes.push({ item, section, value: undefined })
                        }
                    }

                    if (changes.length) {
                        console.log(changes)

                        transactionManager.startTransaction('updateUserConfiguration', changes)
                    }
                }
            },
            restoreUserConfiguration: {
                method({ item }) {
                    const cache = cacheManager.getCache(item)
                    const changes = []

                    if (cache) {
                        const cacheConfiguration: Map<string, any> = new Map(JSON.parse(cache))

                        for (const [section, value] of cacheConfiguration) {
                            if (configurationManager.getUserConfiguration(section) === value) {
                                changes.push({ item, section, value: undefined })
                            }
                        }
                    }

                    if (changes.length) {
                        transactionManager.startTransaction('updateUserConfiguration', changes)
                    }
                }
            },
            setTextMateRules: {
                method({ item, configurationIndex }) {
                    // const cache = cacheManager.getCache(item)
                    // const cacheConfiguration: Map<string, any> = new Map(cache && JSON.parse(cache))
                    const configuration = configurationManager.getCustomConfiguration(configurationIndex)
                    // {
                    //     'editor.tokenColorCustomizations': {
                    //         textMateRules: [
                    //             {
                    //                 name: 'fontStyle bold',
                    //                 scope: ['constant', 'entity.name.function'],
                    //                 settings: {
                    //                     fontStyle: 'bold'
                    //                 }
                    //             }
                    //         ]
                    //     }
                    // }
                    let changes = new Map()
                    const editorTokenColorCustomizations = configuration.get('editor.tokenColorCustomizations')
                    const userEditorTokenColorCustomizations = configurationManager.getUserConfiguration('editor.tokenColorCustomizations')

                    if (userEditorTokenColorCustomizations) {
                        const userTextMateRules = userEditorTokenColorCustomizations.textMateRules
                        const textMateRules = editorTokenColorCustomizations.textMateRules

                        if (userTextMateRules) {
                            for (const { name, scope: userScope, settings } of userTextMateRules) {
                                if (name === 'fontStyle bold' && settings && settings.fontStyle === 'bold') {
                                    const scope = textMateRules.scope
                                    const items = []

                                    if (userScope) {
                                        const userScopeSet = new Set(userScope)

                                        for (const value of scope) {
                                            if (!userScopeSet.has(value)) {
                                                userScopeSet.add(value)
                                            }
                                        }
                                    } else {
                                    }
                                }
                            }
                        } else {
                            userEditorTokenColorCustomizations.textMateRules = editorTokenColorCustomizations.textMateRules
                        }
                    } else {
                        changes = configuration
                    }

                    // configurationManager
                    //     .updateUserConfiguration(
                    //         new Map(
                    //             Object.entries({
                    //                 'editor.tokenColorCustomizations': {
                    //                     textMateRules: [
                    //                         {
                    //                             name: 'fontStyle bold',
                    //                             scope: ['entity.name.function'],
                    //                             settings: {
                    //                                 fontStyle: 'bold'
                    //                             }
                    //                         }
                    //                     ]
                    //                 }
                    //             })
                    //         )
                    //     )
                    //     .then(() => {
                    //         console.log('sec')
                    //     })
                }
            }
        })
    }
}

type listenerType = Map<string, { value: any; callback(): void }[]>
type listenerMethodType = (e: vscode.ConfigurationChangeEvent) => void

const listenerManager = {
    lazyloaded: false as boolean,
    storage: new Map() as Map<string, listenerType>,
    recycleBin: [] as vscode.Disposable[],
    handler: {
        configuration(e) {
            const listener = listenerManager.storage.get('configuration') as listenerType

            for (const [configuration, changes] of listener) {
                if (e.affectsConfiguration(configuration)) {
                    const configurationValue = configurationManager.getUserConfiguration(configuration)

                    for (const { value, callback } of changes) {
                        if (configurationValue === value) {
                            return callback()
                        }
                    }
                }
            }
        }
    } as { [propName: string]: listenerMethodType },
    _middleware(handler: listenerMethodType): listenerMethodType {
        return e => {
            listenerManager.lazyload()
            handler(e)
        }
    },
    lazyload(): void {
        if (!this.lazyloaded) {
            configurationManager.initialize()
            eventManager.initialize()
            transactionManager.initialize()
        }
        this.lazyloaded = true
    },
    addListener(type: string, arr: { item: string; changes: object[] }[]): void {
        const map = new Map()
        for (const { item, changes } of arr) {
            map.set(item, changes)
        }
        this.storage.set(type, map)
    },
    getListener(type: string): listenerMethodType {
        return this._middleware(this.handler[type])
    },
    initialize(): void {
        this.addListener('configuration', [
            {
                item: 'barrier-free-theme.experienceMode',
                changes: [
                    {
                        value: undefined,
                        callback() {
                            eventManager.execute('restoreUserConfiguration', {
                                item: 'barrier-free-theme.experienceMode'
                            })
                        }
                    },
                    {
                        value: 'on',
                        callback() {
                            eventManager.execute('mergeUserConfiguration2', {
                                item: 'barrier-free-theme.experienceMode',
                                configurationIndex: 'experienceModeOn'
                            })
                        }
                    },
                    {
                        value: 'advance',
                        callback() {
                            eventManager.execute('mergeUserConfiguration2', {
                                item: 'barrier-free-theme.experienceMode',
                                configurationIndex: 'experienceModeAdvance'
                            })
                        }
                    }
                ]
            },
            {
                item: 'barrier-free-theme.bold',
                changes: [
                    {
                        value: undefined,
                        callback() {
                            // eventManager.execute('setTextMateRules', {
                            //     item: 'barrier-free-theme.bold',
                            //     configurationIndex: 'boldOff'
                            // })
                            transactionManager.startTransaction('updateUserConfiguration', [
                                { item: 'barrier-free-theme.experienceMode', section: 'editor.foldingHighlight', value: undefined },
                                { item: 'barrier-free-theme.experienceMode', section: 'editor.hideCursorInOverviewRuler', value: undefined },
                                { item: 'barrier-free-theme.experienceMode', section: 'editor.smoothScrolling', value: undefined },
                                { item: 'barrier-free-theme.experienceMode', section: 'workbench.list.smoothScrolling', value: undefined },
                                { item: 'barrier-free-theme.experienceMode', section: 'editor.scrollbar.verticalScrollbarSize', value: undefined },
                                { item: 'barrier-free-theme.experienceMode', section: 'breadcrumbs.enabled', value: undefined },
                                { item: 'barrier-free-theme.experienceMode', section: 'editor.minimap.enabled', value: undefined },
                                { item: 'barrier-free-theme.experienceMode', section: 'search.maxResults', value: undefined }
                            ])
                        }
                    },
                    {
                        value: true,
                        callback() {
                            // eventManager.execute('setTextMateRules', {
                            //     item: 'barrier-free-theme.bold',
                            //     configurationIndex: 'boldOn'
                            // })
                            transactionManager.startTransaction('updateUserConfiguration', [
                                { item: 'barrier-free-theme.experienceMode', section: 'editor.foldingHighlight', value: false },
                                { item: 'barrier-free-theme.experienceMode', section: 'editor.hideCursorInOverviewRuler', value: true },
                                { item: 'barrier-free-theme.experienceMode', section: 'editor.smoothScrolling', value: true },
                                { item: 'barrier-free-theme.experienceMode', section: 'workbench.list.smoothScrolling', value: true },
                                { item: 'barrier-free-theme.experienceMode', section: 'editor.scrollbar.verticalScrollbarSize', value: 24 },
                                { item: 'barrier-free-theme.experienceMode', section: 'breadcrumbs.enabled', value: false },
                                { item: 'barrier-free-theme.experienceMode', section: 'editor.minimap.enabled', value: false },
                                { item: 'barrier-free-theme.experienceMode', section: 'search.maxResults', value: 100 }
                            ])
                        }
                    }
                ]
            }
        ])
        this.recycleBin.push(vscode.workspace.onDidChangeConfiguration(this.getListener('configuration')))
    }
}

type ConfigurationType = Map<string, any>

const configurationManager = {
    storage: new Map() as Map<string, ConfigurationType>,
    getCustomConfiguration(index: string): ConfigurationType {
        return this.storage.get(index) as ConfigurationType
    },
    setCustomConfiguration(index: string, configuration: { [propName: string]: any }): void {
        const map = new Map()
        for (const section in configuration) {
            map.set(section, configuration[section])
        }
        this.storage.set(index, map)
    },
    getUserConfiguration(section: string): any {
        return vscode.workspace.getConfiguration().inspect(section)?.globalValue
    },
    async updateUserConfiguration(section: string, value: any): Promise<void> {
        await vscode.workspace.getConfiguration().update(section, value, true)
    },
    computeMergeConfiguration(configuration: ConfigurationType): ConfigurationType {
        const result: ConfigurationType = new Map()

        for (const [key, value] of configuration) {
            const userConfigurationValue = this.getUserConfiguration(key)
            if (userConfigurationValue === undefined || isDeepStrictEqual(userConfigurationValue, value)) {
                result.set(key, value)
            }
        }

        return result
    },
    checkConfigurationIsDefault(section: string): boolean {
        return this.getUserConfiguration(section) === undefined
    },
    initialize(): void {
        this.setCustomConfiguration('experienceModeOn', {
            'editor.foldingHighlight': false,
            'editor.hideCursorInOverviewRuler': true,
            'editor.scrollbar.verticalScrollbarSize': 24,
            'editor.smoothScrolling': true,
            'workbench.list.smoothScrolling': true
        })
        this.setCustomConfiguration('experienceModeAdvance', {
            'breadcrumbs.enabled': false,
            'editor.minimap.enabled': false,
            'editor.foldingHighlight': false,
            'editor.hideCursorInOverviewRuler': true,
            'editor.scrollbar.verticalScrollbarSize': 24,
            'editor.smoothScrolling': true,
            'editor.stickyScroll.enabled': true,
            'workbench.list.smoothScrolling': true
        })
        this.setCustomConfiguration('boldOn', {
            'editor.tokenColorCustomizations': {
                textMateRules: [
                    {
                        name: 'fontStyle bold',
                        scope: ['constant', 'entity.name.function'],
                        settings: {
                            fontStyle: 'bold'
                        }
                    }
                ]
            }
        })
        this.setCustomConfiguration('boldOff', {
            'editor.tokenColorCustomizations': {
                textMateRules: [
                    {
                        name: 'fontStyle bold',
                        scope: [],
                        settings: {
                            fontStyle: 'bold'
                        }
                    }
                ]
            }
        })
    }
}

type transactionType = {
    isRunning: boolean
    queue: any[]
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

const transactionManager = {
    storage: new Map() as Map<string, transactionType>,
    restartTime: 300 as number,
    maxRolls: 3 as number,
    addTransaction(name: string, method: transactionType['method']): void {
        this.storage.set(name, {
            isRunning: false,
            queue: [],
            failed: [],
            succeeded: [],
            maxRolls: this.maxRolls,
            method
        })
    },
    startTransaction(name: string, args: any[]): void {
        const transaction = this.storage.get(name) as transactionType

        transaction.queue.push(...args)

        if (!transaction.isRunning) {
            this._executeTransaction(name)
        }
    },
    _executeTransaction(name: string): void {
        const transaction = this.storage.get(name) as transactionType
        const { queue, method, failed, succeeded } = transaction
        const { handler, rejected, resolved } = method
        const item = queue[0]

        transaction.isRunning = true

        handler(item)
            .then(
                (result: unknown) => {
                    resolved(item, result)
                    succeeded.push(item)
                    queue.shift()
                },
                (error: unknown) => {
                    transaction.maxRolls -= 1
                    if (transaction.maxRolls === 0) {
                        rejected(item, error)
                        failed.push(item)
                        queue.shift()
                        transaction.maxRolls = transactionManager.maxRolls
                    }
                }
            )
            .finally(() => {
                if (queue.length) {
                    if (transaction.maxRolls === 3) {
                        setTimeout(() => transactionManager._executeTransaction(name), 0)
                    } else {
                        setTimeout(() => transactionManager._executeTransaction(name), transactionManager.restartTime)
                    }
                } else {
                    method.end(succeeded, failed)
                    transaction.succeeded = []
                    transaction.failed = []
                    transaction.isRunning = false
                }
            })
    },
    initialize(): void {
        transactionManager.addTransaction('updateUserConfiguration', {
            handler({ section, value }: { section: string; value: any }) {
                return configurationManager.updateUserConfiguration(section, value)
            },
            rejected({ item, section, value }: { item: string; section: string; value: any }, error: string) {
                vscode.window.showErrorMessage(error)
                console.log('Transaction: updateUserConfiguration failed: ', section, value)
            },
            resolved({ item, section, value }: { item: string; section: string; value: any }) {
                // cacheManager.updateCacheWithMap(item, new Map([[section, value]])).then(() => {
                // console.log('Transaction: resolved', section, value, cacheManager.getCache(item))
                // })
            },
            end(succeeded, failed): void {
                const item = succeeded[0].item
                const configuration = new Map()

                for (const { section, value } of succeeded) {
                    configuration.set(section, value)
                }

                for (const { section, value } of failed) {
                    if (isDeepStrictEqual(value, configurationManager.getUserConfiguration(section))) configuration.set(section, value)
                }

                if (configuration.size) {
                    cacheManager.updateCacheWithMap(item, configuration).then(() => {
                        console.log('Transaction: succeeded', new Map(JSON.parse(cacheManager.getCache(item) as string)).size)
                    })
                }
            }
        })
    }
}

const Controller = {
    activate(context: vscode.ExtensionContext): void {
        cacheManager.initialize(context)
        listenerManager.initialize()
        console.log('Initialized:', cacheManager.getCache('barrier-free-theme.experienceMode'))
        // cacheManager
        //     .updateCache('barrier-free-theme.experienceMode')
        //     .then(() => console.log('Initialized: ', cacheManager.getCache('barrier-free-theme.experienceMode')))
    },

    deactivate(context: vscode.ExtensionContext): void {
        context.subscriptions.push(...listenerManager.recycleBin)
        console.log('Deactivated:', cacheManager.getCache('barrier-free-theme.experienceMode'))
    }
}

exports.activate = Controller.activate
exports.deactivate = Controller.deactivate
