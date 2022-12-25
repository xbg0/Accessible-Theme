import * as vscode from 'vscode'

export function activate(context: vscode.ExtensionContext) {
    console.log(
        'Congratulations, your extension "helloworld-sample" is now active!'
    )
    const disposable = vscode.commands.registerCommand(
        'extension.helloWorld',
        () => {
            vscode.window.showInformationMessage('11s')
        }
    )

    context.subscriptions.push(disposable)
}
