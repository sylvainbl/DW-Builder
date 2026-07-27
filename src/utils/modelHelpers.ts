import type { ArmyModel } from '../types/index'

export function duplicateArmyModel(source: ArmyModel, modelId: string): ArmyModel {
    return {
        ...structuredClone(source),
        modelId,
    }
}
