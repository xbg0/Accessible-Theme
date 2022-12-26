import * as vscode from 'vscode'

const storageKey = 'xbg.barrier-free-theme'
const settingKey = 'barrier-free-theme.optimalSettings.enable'

const optimalSettings = new Map(
    Object.entries({
        'editor.foldingHighlight': false,
        'editor.hideCursorInOverviewRuler': true,
        'editor.scrollbar.verticalScrollbarSize': 24,
        'editor.smoothScrolling': true,
        'workbench.list.smoothScrolling': true
    })
)

const defaultSettings = new Map(
    Object.entries({
        'editor.foldingHighlight': true,
        'editor.hideCursorInOverviewRuler': false,
        'editor.scrollbar.verticalScrollbarSize': 14,
        'editor.smoothScrolling': false,
        'workbench.list.smoothScrolling': false
    })
)

function getConfig() {
    return vscode.workspace.getConfiguration()
}

function enter(globalState: vscode.Memento) {
    const config = getConfig()
    if (config.get(settingKey)) {
        cleanStorage(globalState)
        mount(config, globalState)
    } else {
        unmount(config, globalState)
    }
}

function cleanStorage(globalState: vscode.Memento) {
    globalState.update(storageKey, undefined)
}

function mount(
    config: vscode.WorkspaceConfiguration,
    globalState: vscode.Memento
) {
    const used = applySetting(config)
    if (used) {
        globalState.update(storageKey, JSON.stringify([...used]))
    }
    console.log(1, used)
}

function unmount(
    config: vscode.WorkspaceConfiguration,
    globalState: vscode.Memento
) {
    const used: string | undefined = globalState.get(storageKey)
    if (used) {
        repealSetting(config, JSON.parse(used))
        cleanStorage(globalState)
    }
    console.log(2, used)
}

function applySetting(
    config: vscode.WorkspaceConfiguration
): Set<string> | undefined {
    const used: Set<string> = new Set()
    for (const [key, value] of optimalSettings) {
        if (config.get(key) === defaultSettings.get(key)) {
            used.add(key)
            config.update(key, value, vscode.ConfigurationTarget.Global)
        }
    }
    return used.size === 0 ? undefined : used
}

function repealSetting(
    config: vscode.WorkspaceConfiguration,
    used: Set<string>
) {
    for (const key of used) {
        if (config.get(key) === optimalSettings.get(key)) {
            config.update(key, undefined, vscode.ConfigurationTarget.Global)
        }
    }
}

function init(context: vscode.ExtensionContext) {
    context.globalState.setKeysForSync([storageKey])
}

export function activate(context: vscode.ExtensionContext) {
    init(context)
    enter(context.globalState)
    const disposable = [
        // vscode.commands.registerCommand('extension.helloWorld', enter),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(settingKey)) {
                enter(context.globalState)
            }
        })
    ]

    context.subscriptions.push(...disposable)
}

export function deactivate(context: vscode.ExtensionContext) {
    console.log(3)
    unmount(getConfig(), context.globalState)
}
