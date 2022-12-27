import * as vscode from 'vscode'

const storageKey = 'barrier-free-theme.settings'
const settingKey = 'barrier-free-theme.optimalSettings'
const baseSettings = '0'
const advancedSettings = '1'

const optimalSettings: { [propName: string]: Map<string, any> } = {
    [baseSettings]: new Map(
        Object.entries({
            'editor.foldingHighlight': false,
            'editor.hideCursorInOverviewRuler': true,
            'editor.scrollbar.verticalScrollbarSize': 24,
            'editor.smoothScrolling': true,
            'workbench.list.smoothScrolling': true
        })
    ),
    [advancedSettings]: new Map(
        Object.entries({
            'editor.foldingHighlight': false,
            'editor.hideCursorInOverviewRuler': true,
            'editor.scrollbar.verticalScrollbarSize': 24,
            'editor.smoothScrolling': true,
            'workbench.list.smoothScrolling': true,
            'breadcrumbs.enabled': false
        })
    )
}

const defaultSettings = new Map(
    Object.entries({
        'editor.foldingHighlight': true,
        'editor.hideCursorInOverviewRuler': false,
        'editor.scrollbar.verticalScrollbarSize': 14,
        'editor.smoothScrolling': false,
        'workbench.list.smoothScrolling': false,
        'breadcrumbs.enabled': true
    })
)

interface Controller {
    globalState: vscode.Memento | null
    init(context: vscode.ExtensionContext): void
    getConfig(key: string): any
    getSettings(type: string): Map<string, any>
    getUserSettings(
        keys: Set<string> | IterableIterator<string>
    ): Map<string, any>
    getCacheSettings(): { settings: Set<string>; type: string | null }
    computeMountSettings(
        settings: Map<string, any>,
        userSettings: Map<string, any>,
        cacheSettings: Set<string>
    ): Set<string>
    computeUnmountSettings(
        settings: Map<string, any>,
        userSettings: Map<string, any>
    ): Set<string>
    updateUserSettings(
        settings: Map<string, any>,
        keys: Set<string>,
        override?: boolean
    ): void
    updateCacheSettings(object: { settings: Set<string>; type: string }): void
    mount(type: string): void
    unmount(): void
    entrance(): void
    cleanStorage(): void
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

    getCacheSettings() {
        const cache: string | undefined = this.globalState?.get(storageKey)
        if (cache) {
            const { settings, type } = JSON.parse(cache)
            return { settings: JSON.parse(settings), type }
        } else {
            return { settings: new Set(), type: null }
        }
    },

    computeMountSettings(settings, userSettings, cacheSettings) {
        const result: Set<string> = new Set()
        for (const [key] of settings) {
            if (
                !cacheSettings.has(key) &&
                userSettings.get(key) === defaultSettings.get(key)
            ) {
                result.add(key)
            }
        }
        return result
    },

    computeUnmountSettings(settings, userSettings) {
        const result: Set<string> = new Set()
        for (const [key, value] of userSettings) {
            if (settings.get(key) === value) {
                result.add(key)
            }
        }
        return result
    },

    updateUserSettings(settings, keys, override) {
        for (const key of keys) {
            vscode.workspace
                .getConfiguration()
                .update(
                    key,
                    override ? undefined : settings.get(key),
                    vscode.ConfigurationTarget.Global
                )
        }
    },

    updateCacheSettings({ settings, type }) {
        this.globalState?.update(
            storageKey,
            JSON.stringify({ settings: JSON.stringify([...settings]), type })
        )
    },

    mount(type) {
        const settings = this.getSettings(type)
        const userSettings = this.getUserSettings(settings.keys())
        const cacheSettings = this.getCacheSettings().settings
        const keys: Set<string> = this.computeMountSettings(
            settings,
            userSettings,
            cacheSettings
        )

        if (keys.size > 0) {
            this.updateUserSettings(settings, keys)
            this.updateCacheSettings({ settings: keys, type })
        }
        console.log('Mounted')
    },

    unmount() {
        const { settings: cacheSettings, type } = this.getCacheSettings()

        if (type) {
            const settings = this.getSettings(type)
            const userSettings = this.getUserSettings(cacheSettings)
            const keys: Set<string> = this.computeUnmountSettings(
                settings,
                userSettings
            )

            if (keys.size > 0) {
                this.updateUserSettings(defaultSettings, keys, true)
                this.cleanStorage()
            }
        }

        console.log('Unmounted')
    },

    entrance() {
        const config = this.getConfig(settingKey)
        switch (config) {
            case 'off':
                this.unmount()
                break
            case 'on':
                this.mount(baseSettings)
                break
            case 'advance':
                this.mount(advancedSettings)
                break
        }
    },

    cleanStorage() {
        this.globalState?.update(storageKey, undefined)
    }
}

export function activate(context: vscode.ExtensionContext) {
    Controller.init(context)
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(settingKey)) {
                Controller.entrance()
            }
        })
    )
}
