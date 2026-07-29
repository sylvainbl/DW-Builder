import assert from 'node:assert/strict'
import test from 'node:test'
import type { ArmyList, ArmyUnit, BattlefleetDefinition, Unit, UnitConfig, Weapon } from '../types/index.ts'
import { buildShareableListSummary } from './shareList.ts'

function makeConfig(): UnitConfig {
    return {
        hardpointSelections: {},
        generatorSelection: null,
        fleetDoctrineSelection: null,
        optionQuantities: {},
    }
}

function makeUnit(id: string, name: string, subName: string, role: string, overrides: Partial<Unit> = {}): Unit {
    return {
        id,
        faction_id: 'test',
        name,
        sub_name: subName,
        faction: 'Test',
        role,
        point_cost_per_model: 1,
        vpr: 0,
        models: 1,
        tags: [],
        stats: { MAS: 1, SPD: '1"', TRN: 1, DEF: 1, ARM: 1, HUL: 1, ACT: 1, BRD: 1, REP: 1, CRW: 1 },
        properties: [],
        systems: [],
        weapons: [],
        hardpoint_options: {},
        options_and_upgrades: [],
        lore: '',
        version: 'test',
        date: 'test',
        ...overrides,
    }
}

function makeEntry(
    instanceId: string,
    unitId: string,
    modelNames: Array<string | undefined>,
    totalPoints: number,
    overrides: Partial<ArmyUnit> = {},
): ArmyUnit {
    return {
        instanceId,
        unitId,
        config: makeConfig(),
        models: modelNames.map((customName, index) => ({
            modelId: `${instanceId}-model-${index}`,
            customName,
            config: makeConfig(),
        })),
        totalPoints,
        ...overrides,
    }
}

test('the share summary uses canonical names and includes every formation, ship count and point value without double-counting attachments', () => {
    const units = [
        makeUnit('lyon', 'Lyon', 'Levant Heavy Cruiser', 'Line'),
        makeUnit('alma', 'Alma', 'Levant Support Cruiser', 'Support', {
            weapons: [
                {
                    name: 'Light Gun Battery',
                    arc: 'FPS',
                    firepower: { C: 1, S: 1, E: null },
                    qualities: [],
                },
            ],
        }),
        makeUnit('ecuyer', 'Ecuyer', 'Support Cruiser', 'Support'),
    ]
    const attachment = makeEntry('alma-entry', 'alma', [undefined], 50)
    const list: ArmyList = {
        id: 'list',
        name: 'Test Fleet',
        faction_id: 'alliance',
        battlefleets: [
            {
                instanceId: 'battlefleet-1',
                definitionId: 'grand-battlefleet',
                name: 'Grand Battlefleet',
                customName: 'Task Force Alpha',
            },
            {
                instanceId: 'battlefleet-2',
                definitionId: 'reserve-battlefleet',
                name: 'Reserve Battlefleet',
            },
        ],
        units: [
            makeEntry('lyon-entry', 'lyon', ['Le Rhône', 'Le Saône'], 330, {
                customName: 'First Division',
                battlefleetInstanceId: 'battlefleet-1',
                attachedUnits: [attachment],
            }),
            makeEntry('ecuyer-entry', 'ecuyer', [undefined], 50),
        ],
        createdAt: 'test',
        updatedAt: 'test',
    }
    const definitions: BattlefleetDefinition[] = [
        {
            id: 'grand-battlefleet',
            faction_id: 'alliance',
            name: 'Grand Battlefleet',
            type: 'main',
            elements: [],
        },
        {
            id: 'reserve-battlefleet',
            faction_id: 'alliance',
            name: 'Reserve Battlefleet',
            type: 'specialist',
            elements: [],
        },
    ]

    assert.equal(
        buildShareableListSummary(list, units, definitions, 'Alliance'),
        [
            '**Test Fleet — Alliance — 380 pts**',
            '',
            '*Battlefleet: Grand Battlefleet — 330 pts*',
            '- 2× **Lyon** — **280 pts**  ',
            `${'\u00a0'.repeat(8)}Attachment: 1× **Alma** — **50 pts**  `,
            `${'\u00a0'.repeat(16)}*1 L. Gun Battery*`,
            '',
            '*Battlefleet: Reserve Battlefleet — 0 pts*',
            '- No ships',
            '',
            'Unassigned — 50 pts',
            '- 1× **Ecuyer** — **50 pts**',
        ].join('\n'),
    )
})

test('the equipment summary aggregates final weapons, generators and options across models', () => {
    const weapon = (name: string, slot?: string): Weapon => ({
        name,
        arc: 'FPS',
        slot,
        firepower: { C: 1, S: 1, E: null },
        qualities: [],
    })
    const charlemagne = makeUnit('charlemagne', 'Charlemagne', 'Heavy Cruiser', 'Line', {
        weapons: [
            weapon('Focused Torpedo Turret'),
            weapon('Focused Heavy Gun Battery', 'H'),
            weapon('Focused Light Gun Battery'),
        ],
        hardpoint_options: {
            H: [weapon('Focused Heavy Magnetic Bombard'), weapon('Focused Heat Lance')],
        },
        options_and_upgrades: [
            {
                description: 'Replace one Heavy Hardpoint with a Generator Hardpoint',
                cost_per_unit: null,
                max: 1,
                tag: 'GENERATOR',
            },
            {
                description: 'Add armour plating',
                display_name: 'Armour Plating',
                cost_per_unit: 5,
                max: 2,
                tag: 'ARMOUR_PLATING',
            },
            {
                description: 'Remove the Focused Light Gun Battery',
                display_name: 'Sensor Refit',
                cost_per_unit: 5,
                max: 1,
                tag: 'SENSOR_REFIT',
                removes_weapons: ['Focused Light Gun Battery'],
            },
            {
                description: 'Add Escorts to this unit',
                cost_per_unit: 5,
                max: 4,
                tag: 'ESCORT',
            },
        ],
    })
    const entry = makeEntry('charlemagne-entry', charlemagne.id, [undefined, undefined, undefined], 450, {
        battlefleetInstanceId: 'battlefleet-1',
        config: {
            ...makeConfig(),
            optionQuantities: { ESCORT: 2 },
        },
        models: [
            {
                modelId: 'model-1',
                config: {
                    ...makeConfig(),
                    hardpointSelections: { 1: 'Focused Heavy Magnetic Bombard' },
                    optionQuantities: { ARMOUR_PLATING: 2, SENSOR_REFIT: 1 },
                },
            },
            {
                modelId: 'model-2',
                config: {
                    ...makeConfig(),
                    generatorSelection: {
                        weaponIndex: 1,
                        generatorName: 'Heavy Shield Generator',
                        generatorCost: 15,
                    },
                    optionQuantities: { ARMOUR_PLATING: 1 },
                },
            },
            {
                modelId: 'model-3',
                config: {
                    ...makeConfig(),
                    hardpointSelections: { 1: 'Focused Heat Lance' },
                },
            },
        ],
    })
    const list: ArmyList = {
        id: 'list',
        name: 'Alliance Fleet',
        faction_id: 'alliance',
        battlefleets: [
            {
                instanceId: 'battlefleet-1',
                definitionId: 'grand-battlefleet',
                name: 'Grand Battlefleet',
            },
        ],
        units: [entry],
        createdAt: 'test',
        updatedAt: 'test',
    }
    const definitions: BattlefleetDefinition[] = [
        {
            id: 'grand-battlefleet',
            faction_id: 'alliance',
            name: 'Grand Battlefleet',
            type: 'main',
            elements: [],
        },
    ]

    const summary = buildShareableListSummary(list, [charlemagne], definitions, 'Alliance')

    assert.match(
        summary,
        /- 3× \*\*Charlemagne\*\* — \*\*450 pts\*\* {2}\n\u00a0{8}\*3 F\. Torpedo Turret \/ 1 F\. H\. Magnetic Bombard \/ 2 F\. L\. Gun Battery \/ 1 F\. Heat Lance \/ 1 H\. Shield G\. \/ 3 Armour Plating \/ 1 Sensor Refit \/ 2 Escort\*/,
    )
})
