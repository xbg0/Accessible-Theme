import { workspace } from 'vscode'

const configManager = {
    getUserConfig(section: string): any {
        return workspace.getConfiguration().inspect(section)?.globalValue
    },
    async updateUserConfig(section: string, value: any): Promise<void> {
        await workspace.getConfiguration().update(section, value, true)
    },
    isDefaultConfig(section: string): boolean {
        return this.getUserConfig(section) === undefined
    }
}

export default configManager
