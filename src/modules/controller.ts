import { ExtensionContext } from 'vscode'

let context = {} as ExtensionContext

export const getContext = (): ExtensionContext => {
    return context
}

export const initialize = (ct: ExtensionContext) => {
    context = ct
}
