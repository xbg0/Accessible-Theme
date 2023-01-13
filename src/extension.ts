import * as vscode from 'vscode'

function isEqual(object1: any, object2: any): boolean {
    return Object.is(object1, object2)
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
            setUserConfiguration: {
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
                            (!isEqual(cacheConfigurationValue, value) && isEqual(userConfigurationValue, cacheConfigurationValue))
                        ) {
                            changes.push({ item, section, value })
                        }
                    }

                    for (const [section, value] of cacheConfiguration) {
                        if (!configuration.has(section) && isEqual(value, configurationManager.getUserConfiguration(section))) {
                            changes.push({ item, section, value: undefined })
                        }
                    }

                    if (changes.length) {
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
            mergeTextMateRules: {
                method({ item, configurationIndex }) {
                    const configuration = configurationManager.getCustomConfiguration(configurationIndex)
                    const editorTokenColorCustomizations = configuration.get('editor.tokenColorCustomizations')
                    const userEditorTokenColorCustomizations = configurationManager.getUserConfiguration('editor.tokenColorCustomizations')
                    const cacheScope: Set<string> = new Set(editorTokenColorCustomizations.textMateRules[0].scope)
                    let changes: null | object = null

                    if (userEditorTokenColorCustomizations) {
                        const textMateRules: { name: string; scope: string[]; settings: { fontStyle: string } }[] = editorTokenColorCustomizations.textMateRules
                        const userTextMateRules: { name: string; scope: string[]; settings: { fontStyle: string } }[] =
                            userEditorTokenColorCustomizations.textMateRules

                        if (userTextMateRules) {
                            const example = textMateRules[0]
                            const scope = example.scope
                            const len = userTextMateRules.length

                            if (len) {
                                for (let i = 0; i < len; i++) {
                                    const item = userTextMateRules[i]
                                    const { name, scope: userScope, settings } = item

                                    if (name === 'Font Style: Bold' && settings && Object.keys(settings).length === 1 && settings.fontStyle === 'bold') {
                                        if (userScope) {
                                            const userScopeSet = new Set(userScope)
                                            cacheScope.clear()

                                            for (const value of scope) {
                                                if (!userScopeSet.has(value)) {
                                                    userScopeSet.add(value)
                                                    cacheScope.add(value)
                                                }
                                            }

                                            item.scope = [...userScopeSet]
                                        } else {
                                            item.scope = scope
                                        }

                                        break
                                    } else if (i + 1 === len) {
                                        userTextMateRules.push(example)
                                        break
                                    }
                                }
                            } else {
                                userTextMateRules.push(example)
                            }
                        } else {
                            userEditorTokenColorCustomizations.textMateRules = textMateRules
                        }

                        changes = userEditorTokenColorCustomizations
                    } else {
                        changes = editorTokenColorCustomizations
                    }

                    if (cacheScope.size) {
                        cacheManager.updateCache(item, JSON.stringify([...cacheScope])).then(() => {
                            configurationManager.updateUserConfiguration('editor.tokenColorCustomizations', changes)
                            // console.log(cacheManager.getCache(item))
                        })
                    }
                }
            },
            restoreTextMateRules: {
                method(item) {
                    const cache = cacheManager.getCache(item)

                    if (cache) {
                        const cacheScope: Set<string> = new Set(JSON.parse(cache))
                        let userEditorTokenColorCustomizations = configurationManager.getUserConfiguration('editor.tokenColorCustomizations')
                        let isChanged = false

                        if (userEditorTokenColorCustomizations) {
                            const userTextMateRules: { name: string; scope: string[]; settings: { fontStyle: string } }[] =
                                userEditorTokenColorCustomizations.textMateRules

                            if (userTextMateRules) {
                                for (let i = 0, len = userTextMateRules.length; i < len; i++) {
                                    const item = userTextMateRules[i]
                                    const { name, scope: userScope, settings } = item

                                    if (name === 'Font Style: Bold' && settings && Object.keys(settings).length === 1 && settings.fontStyle === 'bold') {
                                        if (userScope) {
                                            const userScopeSet = new Set(userScope)

                                            for (const value of cacheScope) {
                                                if (userScopeSet.has(value)) {
                                                    userScopeSet.delete(value)
                                                    isChanged = true
                                                }
                                            }

                                            if (isChanged) {
                                                item.scope = [...userScopeSet]
                                            }
                                        }

                                        if (!userScope || !item.scope.length) {
                                            if (userTextMateRules.length === 1) {
                                                if (Object.keys(userEditorTokenColorCustomizations).length === 1) {
                                                    userEditorTokenColorCustomizations = undefined
                                                } else {
                                                    userEditorTokenColorCustomizations.textMateRules = undefined
                                                }
                                            } else {
                                                userTextMateRules.splice(i, 1)
                                            }
                                            isChanged = true
                                        }

                                        break
                                    }
                                }
                            }
                        }

                        cacheManager.updateCache(item).then(() => {
                            if (isChanged) {
                                configurationManager.updateUserConfiguration('editor.tokenColorCustomizations', userEditorTokenColorCustomizations)
                            }
                        })
                    }
                }
            },
            applyConfiguration: {
                method() {
                    const cache = cacheManager.getCache('barrier-free-theme.fontStyle.bold')

                    if (!cache) {
                        const configuration = configurationManager.getUserConfiguration('barrier-free-theme.fontStyle.bold')

                        if (!configuration) {
                            eventManager.execute('mergeTextMateRules', {
                                item: 'barrier-free-theme.fontStyle.bold',
                                configurationIndex: 'fontStyleBold'
                            })
                        }
                    }
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
            this.lazyloaded = true
        }
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
                            eventManager.execute('setUserConfiguration', {
                                item: 'barrier-free-theme.experienceMode',
                                configurationIndex: 'experienceModeOn'
                            })
                        }
                    },
                    {
                        value: 'advance',
                        callback() {
                            eventManager.execute('setUserConfiguration', {
                                item: 'barrier-free-theme.experienceMode',
                                configurationIndex: 'experienceModeAdvance'
                            })
                        }
                    }
                ]
            },
            {
                item: 'barrier-free-theme.fontStyle.bold',
                changes: [
                    {
                        value: undefined,
                        callback() {
                            eventManager.execute('mergeTextMateRules', {
                                item: 'barrier-free-theme.fontStyle.bold',
                                configurationIndex: 'fontStyleBold'
                            })
                        }
                    },
                    {
                        value: false,
                        callback() {
                            eventManager.execute('restoreTextMateRules', 'barrier-free-theme.fontStyle.bold')
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
            if (userConfigurationValue === undefined || isEqual(userConfigurationValue, value)) {
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
            'editor.minimap.enabled': false,
            'editor.foldingHighlight': false,
            'editor.hideCursorInOverviewRuler': true,
            'editor.scrollbar.verticalScrollbarSize': 24,
            'editor.smoothScrolling': true,
            'editor.stickyScroll.enabled': true,
            'workbench.list.smoothScrolling': true
        })
        this.setCustomConfiguration('fontStyleBold', {
            'editor.tokenColorCustomizations': {
                textMateRules: [
                    {
                        name: 'Font Style: Bold',
                        scope: ['constant', 'entity.name.function', 'meta.function-call.python'],
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
                // console.log('Transaction: updateUserConfiguration failed: ', section, value)
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
                    if (isEqual(value, configurationManager.getUserConfiguration(section))) configuration.set(section, value)
                }

                if (configuration.size) {
                    cacheManager.updateCacheWithMap(item, configuration).then(() => {
                        // console.log('Transaction: succeeded', new Map(JSON.parse(cacheManager.getCache(item) as string)).size)
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
        configurationManager.initialize()
        eventManager.initialize()
        transactionManager.initialize()
        eventManager.execute('applyConfiguration')
        // console.log('Initialized:', cacheManager.getCache('barrier-free-theme.fontStyle.bold'))
    },

    deactivate(context: vscode.ExtensionContext): void {
        context.subscriptions.push(...listenerManager.recycleBin)
        // console.log('Deactivated:', cacheManager.getCache('barrier-free-theme.fontStyle.bold'))
    }
}

exports.activate = Controller.activate
exports.deactivate = Controller.deactivate
