import { Disposable } from 'vscode';
import controller from './controller'

type listener = { status: { item: string, callback: (...args: any) => void }[], register(item: string, callback: (...args: any) => void): Disposable }

const listenerManager = {
    addListener({ status, register }: listener) {
        for (const { item, callback } of status) {
            controller.addRecoverer(register(item, callback))
        }
        return this
    }
}

export default listenerManager
