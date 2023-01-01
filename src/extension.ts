import * as vscode from 'vscode'

const StorageKeyOptimalSetting = 'barrier-free-theme.experienceMode'
const SettingKeyOptimalSetting = 'barrier-free-theme.experienceMode'
const BasicSettings = '0'
const AdvancedSettings = '1'

const optimalSettings: { [propName: string]: Map<string, any> } = {
    [BasicSettings]: new Map(
        Object.entries({
            'editor.foldingHighlight': false,
            'editor.hideCursorInOverviewRuler': true,
            'editor.scrollbar.verticalScrollbarSize': 24,
            'editor.smoothScrolling': true,
            'workbench.list.smoothScrolling': true
        })
    ),
    [AdvancedSettings]: new Map(
        Object.entries({
            'breadcrumbs.enabled': false,
            'editor.minimap.enabled': false,
            'editor.foldingHighlight': false,
            'editor.hideCursorInOverviewRuler': true,
            'editor.scrollbar.verticalScrollbarSize': 24,
            'editor.smoothScrolling': true,
            'workbench.list.smoothScrolling': true
        })
    )
}

interface Controller {
    globalState: vscode.Memento | null
    init(context: vscode.ExtensionContext): void
    getConfig(key: string): any
    getSettings(type: string): Map<string, any>
    getUserSettings(
        keys: Set<string> | IterableIterator<string>
    ): Map<string, any>
    getGlobalStorage(key: string): string | undefined
    isChangedSetting(key: string): boolean
    computeMountSettings(settings: Map<string, any>): {
        changes: Map<string, any>
        cacheSettings: Map<string, any>
    }
    computeUnmountSettings(): Map<string, any>
    updateUserSettings(settings: Map<string, any>): Promise<void>
    updateGlobalStorage(key: string, value?: string): Promise<void>
    mount(type: string): void
    unmount(): void
    entrance(): void
}

const Controller: Controller = {
    globalState: null,

    init(context) {
        this.globalState = context.globalState
        console.log('Initialized')
    },

    getConfig(key) {
        return vscode.workspace.getConfiguration().get(key)
    },

    getSettings(type) {
        return optimalSettings[type]
    },

    getUserSettings(keys) {
        const result = new Map()
        for (const key of keys) {
            result.set(key, this.getConfig(key))
        }
        return result
    },

    getGlobalStorage(key) {
        return this.globalState?.get(key)
    },

    isChangedSetting(key) {
        return (
            vscode.workspace.getConfiguration().inspect(key)?.globalValue !==
            undefined
        )
    },

    computeMountSettings(settings) {
        const cache = this.getGlobalStorage(StorageKeyOptimalSetting)
        const cacheSettings: Map<string, any> = new Map(
            cache && JSON.parse(cache)
        )
        const changes = new Map()

        for (const [key, value] of settings) {
            if (cacheSettings.has(key)) {
                const cacheValue = cacheSettings.get(key)
                if (
                    value !== cacheValue &&
                    this.getConfig(key) === cacheValue
                ) {
                    changes.set(key, value)
                    cacheSettings.set(key, value)
                }
            } else {
                if (!this.isChangedSetting(key)) {
                    changes.set(key, value)
                    cacheSettings.set(key, value)
                }
            }
        }

        for (const [key, value] of cacheSettings) {
            if (!settings.has(key)) {
                if (this.getConfig(key) === value) {
                    changes.set(key, undefined)
                }
                cacheSettings.delete(key)
            }
        }

        return { changes, cacheSettings }
    },

    computeUnmountSettings() {
        const cache = this.getGlobalStorage(StorageKeyOptimalSetting)
        const changes = new Map()

        if (cache) {
            const cacheSettings: Map<string, any> = new Map(JSON.parse(cache))

            for (const [key, value] of cacheSettings) {
                if (this.getConfig(key) === value) {
                    changes.set(key, undefined)
                }
            }
        }

        return changes
    },

    async updateUserSettings(settings) {
        const config = vscode.workspace.getConfiguration()

        for (const [key, value] of settings) {
            await config.update(key, value, true)
        }
    },

    async updateGlobalStorage(key, value) {
        await this.globalState?.update(key, value)
    },

    mount(type) {
        const settings = this.getSettings(type)
        const { changes, cacheSettings } = this.computeMountSettings(settings)

        if (changes.size > 0) {
            this.updateUserSettings(changes).then(
                () => {
                    console.log('Update succeeded!')
                },
                message => {
                    vscode.window.showErrorMessage(message)
                    console.log('Update failed: ', message)
                }
            )
            // Write storage by default, Because updating user's setting.json file is unstable
            this.updateGlobalStorage(
                StorageKeyOptimalSetting,
                JSON.stringify([...cacheSettings])
            ).then(
                () => {
                    console.log(
                        'Mounted, ',
                        'Data: ',
                        this.getGlobalStorage(StorageKeyOptimalSetting)
                    )
                },
                message => {
                    vscode.window.showErrorMessage(message)
                    console.log('Mount failed: ', message)
                }
            )
        }
    },

    unmount() {
        const changes = this.computeUnmountSettings()

        if (changes.size > 0) {
            this.updateUserSettings(changes).then(
                () => {
                    console.log('Update succeeded!')
                },
                message => {
                    vscode.window.showErrorMessage(message)
                    console.log('Update failed: ', message)
                }
            )
            this.updateGlobalStorage(StorageKeyOptimalSetting).then(
                () => {
                    console.log(
                        'Unmounted, ',
                        'Data: ',
                        this.getGlobalStorage(StorageKeyOptimalSetting)
                    )
                },
                message => {
                    vscode.window.showErrorMessage(message)
                    console.log('Unmount failed: ', message)
                }
            )
        }
    },

    entrance() {
        const optimalSettingMode = this.getConfig(SettingKeyOptimalSetting)

        switch (optimalSettingMode) {
            case 'off':
                this.unmount()
                break
            case 'on':
                this.mount(BasicSettings)
                break
            case 'advance':
                this.mount(AdvancedSettings)
                break
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    Controller.init(context)
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(SettingKeyOptimalSetting)) {
                Controller.entrance()
            }
        })
    )
}

export function deactivate() {
    Controller.unmount()
    console.log('Deactivated')
}
