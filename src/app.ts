import {
    ExtensionContext,
    window,
    ConfigurationChangeEvent,
    workspace,
    commands,
} from 'vscode'
import { initialize } from './modules/controller'
import { getUserConfig, updateUserConfig, isDefaultConfig } from './modules/config'
import { getCache, updateCache, updateCacheWithMap } from './modules/cache'
import { addQueue, startQueue } from './modules/queue'
import { addEvent, executeEvent } from './modules/event'
import { addListener } from './modules/listener'

type configSetType = {
    [propName in names]: Map<string, any>
}
type configChangesType = { item: string; section: string; value: any }[]
const enum names {
    configExperienceModeOn,
    configExperienceModeAdvance,
    configFontStyleBoldOn,
    configExperienceMode = 'barrier-free-theme.experienceMode',
    configFontStyleBold = 'barrier-free-theme.fontStyle.bold',
    commandEnableBoldDisplay = 'barrier-free-theme.enableBoldDisplay',
    commandDisableBoldDisplay = 'barrier-free-theme.disableBoldDisplay',
}

addEvent('setUserConfig', {
    defaultArgs: {
        [names.configExperienceModeOn]: new Map(
            Object.entries({
                'editor.foldingHighlight': false,
                'editor.hideCursorInOverviewRuler': true,
                'editor.scrollbar.verticalScrollbarSize': 24,
                'editor.smoothScrolling': true,
                'workbench.list.smoothScrolling': true,
            })
        ),
        [names.configExperienceModeAdvance]: new Map(
            Object.entries({
                'editor.minimap.enabled': false,
                'editor.foldingHighlight': false,
                'editor.hideCursorInOverviewRuler': true,
                'editor.scrollbar.verticalScrollbarSize': 24,
                'editor.smoothScrolling': true,
                'editor.stickyScroll.enabled': true,
                'workbench.list.smoothScrolling': true,
            })
        ),
    } as configSetType,
    method(defaultArgs: configSetType, item: string, configIndex: names) {
        const cache = getCache(item)
        const cacheConfig: Map<string, any> = new Map(cache && JSON.parse(cache))
        const config = defaultArgs[configIndex]
        const configChanges: configChangesType = []
        const cacheChanges: Map<string, any> = new Map()

        for (const [section, value] of config) {
            const cacheConfigValue = cacheConfig.get(section)
            if (cacheConfigValue) {
                if (Object.is(getUserConfig(section), cacheConfigValue)) {
                    if (!Object.is(cacheConfigValue, value)) {
                        configChanges.push({ item, section, value })
                    }
                } else {
                    cacheChanges.set(section, undefined)
                }
            } else if (isDefaultConfig(section)) {
                configChanges.push({ item, section, value })
            }
        }

        for (const [section, value] of cacheConfig) {
            if (!config.has(section)) {
                if (Object.is(getUserConfig(section), value)) {
                    configChanges.push({ item, section, value: undefined })
                } else {
                    cacheChanges.set(section, undefined)
                }
            }
        }

        if (cacheChanges.size) {
            updateCacheWithMap(item, cacheChanges)
        }
        if (configChanges.length) {
            startQueue('updateUserConfig', configChanges)
        }
    },
})
addEvent('restoreUserConfig', {
    method(item: string) {
        const cache = getCache(item)

        if (cache) {
            const cacheConfig: Map<string, any> = new Map(JSON.parse(cache))
            const configChanges: configChangesType = []
            const cacheChanges: Map<string, any> = new Map()

            for (const [section, value] of cacheConfig) {
                if (Object.is(getUserConfig(section), value)) {
                    configChanges.push({ item, section, value: undefined })
                } else {
                    cacheChanges.set(section, undefined)
                }
            }

            if (cacheChanges.size) {
                updateCacheWithMap(item, cacheChanges)
            }
            if (configChanges.length) {
                startQueue('updateUserConfig', configChanges)
            }
        }
    },
})
addEvent('mergeTextMateRules', {
    defaultArgs: {
        [names.configFontStyleBoldOn]: new Map(
            Object.entries({
                'editor.tokenColorCustomizations': {
                    textMateRules: [
                        {
                            name: 'Font Style: Bold',
                            scope: [
                                'constant',
                                'entity.name.function',
                                'meta.function-call.python',
                            ],
                            settings: {
                                fontStyle: 'bold',
                            },
                        },
                    ],
                },
            })
        ),
    } as configSetType,
    method(defaultArgs: configSetType, item: string, configIndex: names) {
        const config = defaultArgs[configIndex]
        const editorTokenColorCustomizations = config.get(
            'editor.tokenColorCustomizations'
        )
        const userEditorTokenColorCustomizations = getUserConfig(
            'editor.tokenColorCustomizations'
        )
        const cacheScope: Set<string> = (() => {
            for (const {
                name,
                scope,
            } of editorTokenColorCustomizations.textMateRules) {
                if (name === 'Font Style: Bold') {
                    return new Set(scope)
                }
            }
            return new Set()
        })()
        let changes: null | object = null

        if (userEditorTokenColorCustomizations) {
            const textMateRules: {
                name: string
                scope: string[]
                settings: { fontStyle: string }
            }[] = editorTokenColorCustomizations.textMateRules
            const userTextMateRules: {
                name: string
                scope: string[]
                settings: { fontStyle: string }
            }[] = userEditorTokenColorCustomizations.textMateRules

            if (userTextMateRules) {
                const example = textMateRules[0]
                const scope = example.scope
                const len = userTextMateRules.length

                if (len) {
                    for (let i = 0; i < len; i++) {
                        const item = userTextMateRules[i]
                        const { name, scope: userScope, settings } = item

                        if (
                            name === 'Font Style: Bold' &&
                            settings &&
                            Object.keys(settings).length === 1 &&
                            settings.fontStyle === 'bold'
                        ) {
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
            updateCache(item, JSON.stringify([...cacheScope])).then(() => {
                updateUserConfig('editor.tokenColorCustomizations', changes)
                // console.log(getCache(item))
            })
        }
    },
})
addEvent('restoreTextMateRules', {
    method(item: string) {
        const cache = getCache(item)

        if (cache) {
            const cacheScope: Set<string> = new Set(JSON.parse(cache))
            let userEditorTokenColorCustomizations = getUserConfig(
                'editor.tokenColorCustomizations'
            )
            let isChanged = false

            if (userEditorTokenColorCustomizations) {
                const userTextMateRules: {
                    name: string
                    scope: string[]
                    settings: { fontStyle: string }
                }[] = userEditorTokenColorCustomizations.textMateRules

                if (userTextMateRules) {
                    for (let i = 0, len = userTextMateRules.length; i < len; i++) {
                        const item = userTextMateRules[i]
                        const { name, scope: userScope, settings } = item

                        if (
                            name === 'Font Style: Bold' &&
                            settings &&
                            Object.keys(settings).length === 1 &&
                            settings.fontStyle === 'bold'
                        ) {
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
                                    if (
                                        Object.keys(
                                            userEditorTokenColorCustomizations
                                        ).length === 1
                                    ) {
                                        userEditorTokenColorCustomizations = undefined
                                    } else {
                                        userEditorTokenColorCustomizations.textMateRules =
                                            undefined
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

            updateCache(item).then(() => {
                if (isChanged) {
                    updateUserConfig(
                        'editor.tokenColorCustomizations',
                        userEditorTokenColorCustomizations
                    )
                }
            })
        }
    },
})
addEvent('activate', {
    method() {
        const isBoldDisplay: undefined | false = getUserConfig(
            names.configFontStyleBold
        )

        if (isBoldDisplay === undefined) {
            executeEvent(
                'mergeTextMateRules',
                names.configFontStyleBold,
                names.configFontStyleBoldOn
            )
        }
    },
})

addListener({
    status: [
        {
            item: names.configExperienceMode,
            callback() {
                const configValue = getUserConfig(names.configExperienceMode)

                switch (configValue) {
                    case undefined:
                        executeEvent('restoreUserConfig', names.configExperienceMode)
                        break
                    case 'on':
                        executeEvent(
                            'setUserConfig',
                            names.configExperienceMode,
                            names.configExperienceModeOn
                        )
                        break
                    case 'advance':
                        executeEvent(
                            'setUserConfig',
                            names.configExperienceMode,
                            names.configExperienceModeAdvance
                        )
                }
            },
        },
        {
            item: names.configFontStyleBold,
            callback() {
                const configValue = getUserConfig(names.configFontStyleBold)

                switch (configValue) {
                    case undefined:
                        executeEvent(
                            'mergeTextMateRules',
                            names.configFontStyleBold,
                            'fontStyleBold'
                        )
                        break
                    case false:
                        executeEvent(
                            'restoreTextMateRules',
                            names.configFontStyleBold
                        )
                }
            },
        },
    ],
    register(item, callback) {
        workspace.onDidChangeConfiguration((e: ConfigurationChangeEvent) => {
            if (e.affectsConfiguration(item)) {
                callback()
            }
        })
    },
})
addListener({
    status: [
        {
            item: names.commandEnableBoldDisplay as string,
            callback() {
                updateUserConfig(names.configFontStyleBold, undefined)
            },
        },
        {
            item: names.commandDisableBoldDisplay as string,
            callback() {
                updateUserConfig(names.configFontStyleBold, false)
            },
        },
    ],
    register(item, callback) {
        commands.registerCommand(item, callback)
    },
})

addQueue('updateUserConfig', {
    handler({ section, value }: { section: string; value: any }) {
        return updateUserConfig(section, value)
    },
    resolved(result: string) {
        //window.showInformationMessage(result)
    },
    rejected(error: string) {
        window.showErrorMessage(error)
    },
    end(succeeded, failed) {
        const item: string = succeeded[0].item
        const cacheChanges: Map<string, any> = new Map()

        for (const { section, value } of succeeded) {
            cacheChanges.set(section, value)
        }

        for (const { section, value } of failed) {
            if (Object.is(value, getUserConfig(section))) {
                cacheChanges.set(section, value)
            }
        }

        if (cacheChanges.size) {
            updateCacheWithMap(item, cacheChanges)
        }
    },
})

export const activate = (context: ExtensionContext) => {
    initialize(context)
    executeEvent('activate')
}
