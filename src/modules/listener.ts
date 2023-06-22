import { Disposable } from 'vscode';

type listenerType = { status: { item: string, callback: (...args: any) => void }[], register(item: string, callback: (...args: any) => void): Disposable }

const listenerManager = {
    addListener({ status, register }: listenerType) {
        for (const { item, callback } of status) {
            register(item, callback)
        }
        return this
    }
}

export default listenerManager
