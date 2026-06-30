import type {
    ArmyBattlefleet,
    ArmyList,
    ArmyUnit,
    BattlefleetDefinition,
    BattlefleetType,
    BattlefleetElement,
    BattlefleetIssue,
    BattlefleetRequirement,
    Unit,
} from '../types/index'

function normalizeTrait(value: string): string {
    return value.trim().toLowerCase()
}

function getUnitTraits(unit: Unit): Set<string> {
    return new Set(
        [unit.faction_id, unit.faction, unit.name, unit.sub_name, unit.role, ...unit.tags]
            .filter((trait): trait is string => typeof trait === 'string' && trait.trim().length > 0)
            .map(normalizeTrait),
    )
}

function hasTrait(unit: Unit, trait: string): boolean {
    return getUnitTraits(unit).has(normalizeTrait(trait))
}

function matchesRequirement(entry: ArmyUnit, unit: Unit, requirement: BattlefleetRequirement): boolean {
    if (requirement.unitIds?.includes(entry.unitId)) return true

    const traits = getUnitTraits(unit)
    const hasAll = (requirement.all ?? []).every((trait) => traits.has(normalizeTrait(trait)))
    const hasAny = !requirement.any || requirement.any.some((trait) => traits.has(normalizeTrait(trait)))

    return hasAll && hasAny
}

function matchesElement(entry: ArmyUnit, unit: Unit, element: BattlefleetElement): boolean {
    return element.requirements.some((requirement) => matchesRequirement(entry, unit, requirement))
}

function flattenUnits(entries: ArmyUnit[]): ArmyUnit[] {
    return entries.flatMap((entry) => [entry, ...flattenUnits(entry.attachedUnits ?? [])])
}

function findUnit(units: Unit[], entry: ArmyUnit): Unit | null {
    return units.find((unit) => unit.id === entry.unitId) ?? null
}

function unitLabel(units: Unit[], entry: ArmyUnit): string {
    return findUnit(units, entry)?.name ?? entry.unitId
}

function battlefleetLabel(battlefleet: ArmyBattlefleet, definition?: BattlefleetDefinition): string {
    const typeName = definition?.name || battlefleet.name || battlefleet.definitionId
    return battlefleet.customName ? `${typeName} (${battlefleet.customName})` : typeName
}

export function isBattlefleetAvailableForFaction(definition: BattlefleetDefinition, factionId: string | null | undefined): boolean {
    if (!factionId) return false
    return definition.faction_id === factionId || definition.mercenary === true
}

export function isMercenaryInForce(definition: BattlefleetDefinition, forceFactionId: string | null | undefined): boolean {
    return Boolean(forceFactionId && definition.mercenary && definition.faction_id !== forceFactionId)
}

export function getBattlefleetForceType(definition: BattlefleetDefinition, forceFactionId: string | null | undefined): BattlefleetType {
    return isMercenaryInForce(definition, forceFactionId) ? 'specialist' : definition.type
}

function getMainstayClasses(definition: BattlefleetDefinition, entries: ArmyUnit[]): Set<string> {
    const classNames = new Set((definition.mainstayClassNames ?? []).map(normalizeTrait))
    for (const additional of definition.additionalMainstays ?? []) {
        const hasFlagship = entries.some((entry) => additional.flagshipUnitIds.includes(entry.unitId))
        if (hasFlagship) {
            additional.classNames.forEach((className) => classNames.add(normalizeTrait(className)))
        }
    }
    return classNames
}

function solveElementCounts(
    definition: BattlefleetDefinition,
    entries: ArmyUnit[],
    units: Unit[],
): { valid: boolean; counts: Record<string, number>; unassigned: ArmyUnit[] } {
    const initialCounts = Object.fromEntries(definition.elements.map((element) => [element.id, 0]))
    const candidates = entries.map((entry) => {
        const unit = findUnit(units, entry)
        return {
            entry,
            elements: unit ? definition.elements.filter((element) => matchesElement(entry, unit, element)) : [],
        }
    })

    const unassigned = candidates.filter((candidate) => candidate.elements.length === 0).map((candidate) => candidate.entry)
    if (unassigned.length > 0) {
        return { valid: false, counts: initialCounts, unassigned }
    }

    const ordered = [...candidates].sort((a, b) => a.elements.length - b.elements.length)
    const search = (index: number, counts: Record<string, number>): Record<string, number> | null => {
        if (index >= ordered.length) {
            const hasMinimums = definition.elements.every((element) => counts[element.id] >= element.min)
            return hasMinimums ? { ...counts } : null
        }

        for (const element of ordered[index].elements) {
            if (counts[element.id] >= element.max) continue
            counts[element.id] += 1
            const result = search(index + 1, counts)
            if (result) return result
            counts[element.id] -= 1
        }

        return null
    }

    const validCounts = search(0, { ...initialCounts })
    if (validCounts) return { valid: true, counts: validCounts, unassigned: [] }

    const greedyCounts = { ...initialCounts }
    const greedyUnassigned: ArmyUnit[] = []
    for (const candidate of candidates) {
        const element = candidate.elements.find((item) => greedyCounts[item.id] < item.max)
        if (element) {
            greedyCounts[element.id] += 1
        } else {
            greedyUnassigned.push(candidate.entry)
        }
    }

    return { valid: false, counts: greedyCounts, unassigned: greedyUnassigned }
}

function validateDuplicateClasses(
    definition: BattlefleetDefinition,
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const issues: BattlefleetIssue[] = []
    const mainstayClasses = getMainstayClasses(definition, entries)
    const classCounts = new Map<string, { label: string; count: number }>()
    const exemptBarbudosFlagshipIds = new Set(['alliance_francisco', 'alliance_salvador'])
    let barbudosFlagshipExemptionUsed = false

    for (const entry of entries) {
        const unit = findUnit(units, entry)
        if (!unit) continue
        if (
            definition.specialRules?.includes('barbudos-cruiser-flagship')
            && exemptBarbudosFlagshipIds.has(unit.id)
            && !barbudosFlagshipExemptionUsed
        ) {
            barbudosFlagshipExemptionUsed = true
            continue
        }
        const key = normalizeTrait(unit.name)
        const current = classCounts.get(key) ?? { label: unit.name, count: 0 }
        classCounts.set(key, { ...current, count: current.count + 1 })
    }

    for (const [className, { label, count }] of classCounts) {
        const limit = mainstayClasses.has(className) ? 2 : 1
        if (count > limit) {
            issues.push({
                severity: 'error',
                battlefleetInstanceId: battlefleet.instanceId,
                message: `${battlefleet.name} has ${count} ${label} units; ${mainstayClasses.has(className) ? 'mainstay classes are limited to two' : 'duplicate classes are limited to one'} per Battlefleet.`,
            })
        }
    }

    return issues
}

function validateFlagshipLimit(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const flagshipCount = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Flagship') : false
    }).length

    if (flagshipCount <= 1) return []

    return [{
        severity: 'error',
        battlefleetInstanceId: battlefleet.instanceId,
        message: `${battlefleet.name} has ${flagshipCount} Flagship units; a Battlefleet can contain only one.`,
    }]
}

function validateCommonwealthMainSpecial(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const hasPolishLithuanianFlagship = entries.some((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Polish-Lithuanian') && hasTrait(unit, 'Flagship') : false
    })

    const countedEntries = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        if (!unit || hasTrait(unit, 'Flagship')) return false
        return !(hasPolishLithuanianFlagship && hasTrait(unit, 'Polish-Lithuanian') && hasTrait(unit, 'Airborne'))
    })

    const airborneCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Airborne') : false
    }).length
    const underwaterCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Underwater') : false
    }).length

    const issues: BattlefleetIssue[] = []
    if (airborneCount > 1) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most one Airborne unit, excluding its Flagship and eligible Polish-Lithuanian Airborne units.`,
        })
    }
    if (underwaterCount > 1) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most one Underwater unit, excluding its Flagship.`,
        })
    }
    return issues
}

function validateAirborneUnderwaterLimit(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const countedEntries = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? !hasTrait(unit, 'Flagship') : false
    })
    const airborneCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Airborne') : false
    }).length
    const underwaterCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Underwater') : false
    }).length

    const issues: BattlefleetIssue[] = []
    if (airborneCount > 1) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most one Airborne unit, excluding its Flagship and Attachments.`,
        })
    }
    if (underwaterCount > 1) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most one Underwater unit, excluding its Flagship and Attachments.`,
        })
    }
    return issues
}

function validateBlackWolfSpecial(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const issues: BattlefleetIssue[] = []
    const underwaterCount = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Underwater') : false
    }).length
    const requiredUnderwater = Math.ceil(entries.length / 2)

    if (entries.length > 0 && underwaterCount < requiredUnderwater) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} must have at least half of its units as Underwater units (${underwaterCount}/${requiredUnderwater}).`,
        })
    }

    for (const entry of entries) {
        const unit = findUnit(units, entry)
        if (unit && hasTrait(unit, 'Flagship') && entry.config.fleetDoctrineSelection) {
            issues.push({
                severity: 'error',
                battlefleetInstanceId: battlefleet.instanceId,
                unitInstanceId: entry.instanceId,
                message: `${unit.name} cannot purchase a Fleet Doctrine while assigned as the ${battlefleet.name} Flagship.`,
            })
        }
    }

    return issues
}

function validateEastIndiaPrivateersSpecial(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const palashiCount = entries.filter((entry) => entry.unitId === 'crown_palashi').length
    if (palashiCount === 0) return []

    const hasAdventurer = entries.some((entry) => entry.unitId === 'crown_adventurer')
    const hasOtherFlagship = entries.some((entry) => {
        const unit = findUnit(units, entry)
        return unit ? entry.unitId !== 'crown_adventurer' && hasTrait(unit, 'Flagship') : false
    })

    if (!hasOtherFlagship || hasAdventurer) return []

    return [{
        severity: 'error',
        battlefleetInstanceId: battlefleet.instanceId,
        message: `${battlefleet.name} can include Palashi as a Line unit only when Adventurer is its Flagship.`,
    }]
}

function validateFlagshipNoDoctrine(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    return entries.flatMap((entry) => {
        const unit = findUnit(units, entry)
        if (!unit || !hasTrait(unit, 'Flagship') || !entry.config.fleetDoctrineSelection) return []
        return [{
            severity: 'error' as const,
            battlefleetInstanceId: battlefleet.instanceId,
            unitInstanceId: entry.instanceId,
            message: `${unit.name} cannot purchase a Fleet Doctrine while assigned as the ${battlefleet.name} Flagship.`,
        }]
    })
}

function validateEmpireMainLimit(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const countedEntries = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? !hasTrait(unit, 'Flagship') : false
    })
    const airborneCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Airborne') : false
    }).length
    const underwaterCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Underwater') : false
    }).length

    const issues: BattlefleetIssue[] = []
    if (airborneCount > 2) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most two Airborne units, excluding its Flagship and Attachments.`,
        })
    }
    if (underwaterCount > 1) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most one Underwater unit, excluding its Flagship and Attachments.`,
        })
    }
    return issues
}

function validateEmpireChitaRestrictions(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const countedEntries = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? !hasTrait(unit, 'Flagship') : false
    })
    const airborneCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Airborne') : false
    }).length
    const underwaterCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Underwater') : false
    }).length

    const issues: BattlefleetIssue[] = []
    if (airborneCount > 0) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} cannot include Airborne units, excluding its Flagship and Attachments.`,
        })
    }
    if (underwaterCount > 4) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most four Underwater units, excluding its Flagship and Attachments.`,
        })
    }
    return issues
}

function validateEmpireKagutsuchiLimit(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const countedEntries = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? !hasTrait(unit, 'Flagship') : false
    })
    const airborneCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Airborne') : false
    }).length
    const underwaterCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Underwater') : false
    }).length

    const issues: BattlefleetIssue[] = []
    if (airborneCount > 2) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most two Airborne units, excluding its Flagship and Attachments.`,
        })
    }
    if (underwaterCount > 2) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most two Underwater units, excluding its Flagship and Attachments.`,
        })
    }
    return issues
}

function validateEmpireAirborneOnly(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    return entries.flatMap((entry) => {
        const unit = findUnit(units, entry)
        if (!unit || (hasTrait(unit, 'Airborne') && !hasTrait(unit, 'Surface') && !hasTrait(unit, 'Underwater'))) return []
        return [{
            severity: 'error' as const,
            battlefleetInstanceId: battlefleet.instanceId,
            unitInstanceId: entry.instanceId,
            message: `${battlefleet.name} cannot include Surface or Underwater units.`,
        }]
    })
}

function validateEmpireUnderwaterOnly(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    return entries.flatMap((entry) => {
        const unit = findUnit(units, entry)
        if (!unit || (hasTrait(unit, 'Underwater') && !hasTrait(unit, 'Surface') && !hasTrait(unit, 'Airborne'))) return []
        return [{
            severity: 'error' as const,
            battlefleetInstanceId: battlefleet.instanceId,
            unitInstanceId: entry.instanceId,
            message: `${battlefleet.name} cannot include Airborne or Surface units.`,
        }]
    })
}

function validateEmpireTianlongNoDoctrine(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
): BattlefleetIssue[] {
    return entries.flatMap((entry) => (
        entry.unitId === 'empire_tianlong_draconic_colossus' && entry.config.fleetDoctrineSelection
            ? [{
                severity: 'error' as const,
                battlefleetInstanceId: battlefleet.instanceId,
                unitInstanceId: entry.instanceId,
                message: `Tianlong Draconic Colossus cannot purchase a Fleet Doctrine while assigned to ${battlefleet.name}.`,
            }]
            : []
    ))
}

function validateSpecialRules(
    definition: BattlefleetDefinition,
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const issues: BattlefleetIssue[] = []
    for (const rule of definition.specialRules ?? []) {
        if (rule === 'commonwealth-main-airborne-underwater-limit') {
            issues.push(...validateCommonwealthMainSpecial(battlefleet, entries, units))
        }
        if (rule === 'alliance-main-airborne-underwater-limit' || rule === 'airborne-underwater-limit') {
            issues.push(...validateAirborneUnderwaterLimit(battlefleet, entries, units))
        }
        if (rule === 'black-wolf-underwater-half' || rule === 'black-wolf-flagship-no-doctrine') {
            issues.push(...validateBlackWolfSpecial(battlefleet, entries, units))
            break
        }
        if (rule === 'east-india-palashi-line') {
            issues.push(...validateEastIndiaPrivateersSpecial(battlefleet, entries, units))
        }
        if (rule === 'scions-flagship-no-doctrine') {
            issues.push(...validateFlagshipNoDoctrine(battlefleet, entries, units))
        }
        if (rule === 'empire-main-airborne-underwater-limit') {
            issues.push(...validateEmpireMainLimit(battlefleet, entries, units))
        }
        if (rule === 'empire-chita-restrictions') {
            issues.push(...validateEmpireChitaRestrictions(battlefleet, entries, units))
        }
        if (rule === 'empire-kagutsuchi-airborne-underwater-limit') {
            issues.push(...validateEmpireKagutsuchiLimit(battlefleet, entries, units))
        }
        if (rule === 'empire-airborne-only') {
            issues.push(...validateEmpireAirborneOnly(battlefleet, entries, units))
        }
        if (rule === 'empire-underwater-only') {
            issues.push(...validateEmpireUnderwaterOnly(battlefleet, entries, units))
        }
        if (rule === 'empire-tianlong-flagship-no-doctrine') {
            issues.push(...validateEmpireTianlongNoDoctrine(battlefleet, entries))
        }
    }
    return issues
}

function validateBattlefleet(
    battlefleet: ArmyBattlefleet,
    definition: BattlefleetDefinition,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const issues: BattlefleetIssue[] = []
    const result = solveElementCounts(definition, entries, units)

    for (const entry of result.unassigned) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            unitInstanceId: entry.instanceId,
            message: `${unitLabel(units, entry)} does not match any element in ${battlefleetLabel(battlefleet, definition)}.`,
        })
    }

    for (const element of definition.elements) {
        const count = result.counts[element.id] ?? 0
        if (count < element.min) {
            issues.push({
                severity: 'error',
                battlefleetInstanceId: battlefleet.instanceId,
                message: `${battlefleetLabel(battlefleet, definition)} needs ${element.name}; currently ${count}/${element.min}.`,
            })
        }
        if (count > element.max) {
            issues.push({
                severity: 'error',
                battlefleetInstanceId: battlefleet.instanceId,
                message: `${battlefleetLabel(battlefleet, definition)} has too many units in ${element.name}; currently ${count}/${element.max}.`,
            })
        }
    }

    if (!result.valid && result.unassigned.length === 0) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleetLabel(battlefleet, definition)} units cannot be arranged into the available element limits.`,
        })
    }

    issues.push(...validateFlagshipLimit(battlefleet, entries, units))
    issues.push(...validateDuplicateClasses(definition, battlefleet, entries, units))
    issues.push(...validateSpecialRules(definition, battlefleet, entries, units))

    return issues
}

function validateUniqueUnits(list: ArmyList, units: Unit[]): BattlefleetIssue[] {
    const counts = new Map<string, { unit: Unit; count: number }>()
    for (const entry of flattenUnits(list.units)) {
        const unit = findUnit(units, entry)
        if (!unit || !hasTrait(unit, 'Unique')) continue
        const current = counts.get(unit.id) ?? { unit, count: 0 }
        counts.set(unit.id, { unit, count: current.count + 1 })
    }

    return [...counts.values()].flatMap(({ unit, count }) => (
        count > 1
            ? [{
                severity: 'error' as const,
                message: `${unit.name} is Unique and can only be included once in a Force.`,
            }]
            : []
    ))
}

export function validateBattlefleetOrganisation(
    list: ArmyList | null,
    units: Unit[],
    definitions: BattlefleetDefinition[],
): BattlefleetIssue[] {
    if (!list) return []

    const issues: BattlefleetIssue[] = []
    const availableDefinitions = definitions.filter((definition) => isBattlefleetAvailableForFaction(definition, list.faction_id))
    const definitionById = new Map(availableDefinitions.map((definition) => [definition.id, definition]))
    const battlefleets = list.battlefleets ?? []

    if (battlefleets.length === 0) {
        issues.push({
            severity: 'error',
            message: list.units.length > 0
                ? 'Add at least one Battlefleet and assign every unit to it.'
                : 'A Force must contain at least one Main Battlefleet.',
        })
    }

    const knownBattlefleets = battlefleets.flatMap((battlefleet) => {
        const definition = definitionById.get(battlefleet.definitionId)
        if (!definition) {
            issues.push({
                severity: 'error',
                battlefleetInstanceId: battlefleet.instanceId,
                message: `${battlefleet.name} is not available in this faction ORBAT.`,
            })
            return []
        }
        return [{ battlefleet, definition }]
    })

    const mainCount = knownBattlefleets.filter(({ definition }) => getBattlefleetForceType(definition, list.faction_id) === 'main').length
    const specialistCount = knownBattlefleets.filter(({ definition }) => (
        getBattlefleetForceType(definition, list.faction_id) === 'specialist'
        && !(definition.specialRules?.includes('mercenary-does-not-count') && !isMercenaryInForce(definition, list.faction_id))
    )).length
    const mercenaryCount = knownBattlefleets.filter(({ definition }) => isMercenaryInForce(definition, list.faction_id)).length
    if (knownBattlefleets.length > 0 && mainCount === 0) {
        issues.push({ severity: 'error', message: 'A Force must contain at least one Main Battlefleet.' })
    }
    if (mercenaryCount > 1) {
        issues.push({
            severity: 'error',
            message: `A Force can contain only one Mercenary Battlefleet (${mercenaryCount} selected).`,
        })
    }
    if (specialistCount > mainCount) {
        issues.push({
            severity: 'error',
            message: `A Force cannot contain more Specialist Battlefleets than Main Battlefleets (${specialistCount}/${mainCount}).`,
        })
    }

    const legendaryCounts = new Map<string, { name: string; count: number }>()
    for (const { definition } of knownBattlefleets) {
        if (!definition.legendary) continue
        const current = legendaryCounts.get(definition.id) ?? { name: definition.name, count: 0 }
        legendaryCounts.set(definition.id, { ...current, count: current.count + 1 })
    }
    for (const { name, count } of legendaryCounts.values()) {
        if (count > 1) {
            issues.push({ severity: 'error', message: `${name} is Legendary and can only be included once in a Force.` })
        }
    }

    const battlefleetIds = new Set(battlefleets.map((battlefleet) => battlefleet.instanceId))
    for (const entry of list.units) {
        if (!entry.battlefleetInstanceId || !battlefleetIds.has(entry.battlefleetInstanceId)) {
            issues.push({
                severity: 'error',
                unitInstanceId: entry.instanceId,
                message: `${unitLabel(units, entry)} must be assigned to a Battlefleet.`,
            })
        }
    }

    for (const { battlefleet, definition } of knownBattlefleets) {
        const entries = list.units.filter((entry) => entry.battlefleetInstanceId === battlefleet.instanceId)
        issues.push(...validateBattlefleet(battlefleet, definition, entries, units))
    }

    issues.push(...validateUniqueUnits(list, units))

    return issues
}

export function getBattlefleetDefinitionsForFaction(
    definitions: BattlefleetDefinition[],
    factionId: string | null | undefined,
): BattlefleetDefinition[] {
    return factionId ? definitions.filter((definition) => isBattlefleetAvailableForFaction(definition, factionId)) : []
}
