import { ExtensionContext, Disposable } from 'vscode'

const controller = {
    context: {} as ExtensionContext,
    recoverer: [] as Disposable[],
    getContext(): ExtensionContext {
        return this.context
    },
    // addRecoverer(item: Disposable) {
    //     this.recoverer.push(item)
    // },
    initialize(context: ExtensionContext): void {
        this.context = context
    }
}

export default controller
