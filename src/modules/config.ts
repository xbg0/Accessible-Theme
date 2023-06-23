import { workspace } from 'vscode'

export const getUserConfig = (section: string): any => {
    return workspace.getConfiguration().inspect(section)?.globalValue
}

export const updateUserConfig = async (
    section: string,
    value: any
): Promise<void> => {
    await workspace.getConfiguration().update(section, value, true)
}

export const isDefaultConfig = (section: string): boolean => {
    return getUserConfig(section) === undefined
}
