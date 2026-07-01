import type { BattlefleetBonus } from '../types/index'

export interface BattlefleetDisplayInfo {
    specialRuleText?: string[]
    battlefleetBonus?: BattlefleetBonus
}

const displayInfo: Record<string, BattlefleetDisplayInfo> = {
    'commonwealth-main': {
        specialRuleText: [
            'This Battlefleet can include at most one **Airborne** unit and/or one **Underwater** unit. Its **Flagship** and **Attachments** do not count toward this limit. If it contains a **Polish-Lithuanian Flagship**, **Polish-Lithuanian Airborne** units also do not count toward this limit.',
        ],
        battlefleetBonus: {
            name: 'Acceptable Losses',
            text: 'When a **Commonwealth** model in this Force is **Crippled**, its Admiral may declare it an Acceptable Loss while its unit still has at least two other Battle-Ready models, not counting Attachments. If they do, the opposing Admiral scores no Victory Points for Crippling it, but every model in that unit gains 1 Disorder.',
        },
    },
    'commonwealth-ukrainian-haydamak': {
        specialRuleText: [
            'An **Akula Grand Submarine** with the **Ukrainian** trait can be allocated to this Battlefleet’s Ukrainian Flagship Element. If so, it gains the **Flagship** trait and does not count toward the maximum number of Akula Grand Submarine units this Battlefleet can contain.',
        ],
        battlefleetBonus: {
            name: 'Zaporozhian Spirit',
            text: 'When a **Ukrainian Underwater** unit in this Force makes an Attack action with one or more **Submerged** weapons contributing, its Admiral may discard a Victory & Valour Card before rolling. If they do, the Action Roll is unaffected by Disorder.',
        },
    },
    'commonwealth-skyhost': {
        battlefleetBonus: {
            name: 'Terrors from Above',
            text: 'At the start of their turn, this Admiral may choose a **Commonwealth Airborne** unit with the Incoming status and enact a Special Valour Effect. If successful, the unit loses Incoming and activates immediately; if unsuccessful, it does not activate and another unit activates instead.',
        },
    },
    'commonwealth-black-wolf': {
        specialRuleText: [
            'At least half of the units in this Battlefleet must be **Underwater** units.',
            'A Fleet Doctrine cannot be purchased for this Battlefleet’s **Flagship**. All units in this Battlefleet gain the **Black Wolf** trait if they do not already have it. **Piranya Hunter Submarine** units replace Attachment (Ukrainian) with Attachment (Black Wolf).',
        ],
        battlefleetBonus: {
            name: 'Wolves upon the Fold',
            text: 'When a friendly **Black Wolf** unit makes an Attack or Boarding action against a target with at least 2 levels of Disorder, its Admiral may re-roll any Blank results in the Action Roll.',
        },
    },
    'alliance-main': {
        specialRuleText: [
            'This Battlefleet can include at most one **Airborne** unit and/or one **Underwater** unit. Its **Flagship** and **Attachments** do not count toward this limit.',
        ],
        battlefleetBonus: {
            name: 'Coordinated Support',
            text: 'Once per Round, after an **Alliance** unit in this Force activates, its Admiral may enact a Special Valour Effect. If successful, another friendly Alliance unit within 8 inches that has not activated activates immediately, then gains Activated. No SRS Mission can be resolved between these two activations.',
        },
    },
    'alliance-marine-levante': {
        battlefleetBonus: {
            name: 'Levant Surge',
            text: 'When this Admiral activates a **Marine Levante** unit, they may declare that it makes a Levant Surge this Round. Mark it with a Special Effect token until the start of its next activation. While marked, its Maximum Speed is increased by 3 inches and it does not count as having Low Altitude.',
        },
    },
    'alliance-triarii': {
        battlefleetBonus: {
            name: 'Naval Maniple',
            text: 'All **Italian Patrol** units in this Force gain the Coordinated Defence and Defkoppers systems.',
        },
    },
    'alliance-barbudos': {
        specialRuleText: [
            'A **Francisco Battlecruiser** or **Salvador Battlecruiser** can be allocated to this Battlefleet’s SUSA Flagship Element. If so, it gains the **Flagship** trait and does not count toward the maximum number of Francisco or Salvador units this Battlefleet can contain.',
        ],
        battlefleetBonus: {
            name: 'Veteran Cadre',
            text: 'When this Admiral activates a **SUSA** unit, they may immediately enact a Special Valour Effect. If successful, each model in the unit gains Boarding Party (X), where X is the unit’s Nerve value. If the unit scores at least one Success during a Boarding action this activation, its Admiral gains 3 Victory Points.',
        },
    },
    'alliance-protecao-commercial': {
        battlefleetBonus: {
            name: 'Comunicação Network',
            text: 'Each model in this Force with the **Portuguese** trait gains the Hydrophone Relay system.',
        },
    },
    'alliance-marina-pontificia': {
        specialRuleText: [
            'This Battlefleet can include at most one **Airborne** unit and/or one **Underwater** unit. Its **Flagship** and **Attachments** do not count toward this limit.',
        ],
        battlefleetBonus: {
            name: 'Splendor Dei',
            text: 'This Battlefleet’s **Flagship** gains the Generator Ship system.',
        },
    },
    'crown-main': {
        specialRuleText: [
            'This Battlefleet can include at most one **Airborne** unit and/or one **Underwater** unit. Its **Flagship** does not count toward this limit.',
        ],
        battlefleetBonus: {
            name: 'Lionhearted Crew',
            text: 'When making a Crew Check or Group Crew Check for a **Crown** unit, this Admiral may discard a Victory & Valour Card from their hand instead of drawing the top card of their deck. The discarded card’s Value is used for the Crew Check.',
        },
    },
    'crown-dominion-aegis': {
        specialRuleText: [
            'This Battlefleet can include at most one **Airborne** unit and/or one **Underwater** unit. Its **Flagship** does not count toward this limit.',
        ],
        battlefleetBonus: {
            name: 'Guardian Resonators',
            text: 'If this Admiral declares they will employ Guardian Generators for a model within 5 inches of a friendly **Ceylon Guardian Platform**, they may re-roll Exploding Strike results in the Resistance Roll, in addition to any Blank results.',
        },
    },
    'crown-east-india-privateers': {
        specialRuleText: [
            'If this Battlefleet’s **Flagship** is an **Adventurer Grand Indiaman**, one **Palashi Indiaman** can be included by replacing its Flagship trait with Line. It must be allocated to a Line Element.',
        ],
        battlefleetBonus: {
            name: 'Press the Advantage',
            text: 'As long as this Admiral has more Victory Points than their opponent, they may re-roll any Blank results when making an Action Roll for an **EITC** or **Indian Raj** unit.',
        },
    },
    'crown-nautilus': {
        specialRuleText: [
            'The Nautilus must be allocated to this Element and cannot have Attachments. When taken as part of a Crown Force, this Battlefleet does not count toward the number of Specialist Battlefleets that can be included.',
        ],
    },
    'crown-lords-hood': {
        specialRuleText: [
            '**The Lords Hood** is a **British Sabre Command Cruiser** unit with 3 models. It can take up to four Escort tokens at +10 points each, but cannot take Generator Hardpoints or Attachments.',
        ],
        battlefleetBonus: {
            name: 'Dark Hand',
            text: 'Once per Round, if a model from this unit is in the Play Area, this Admiral may automatically Deny a Valour Effect without discarding a card. If they do, each model in The Lords Hood gains 1 Disorder.',
        },
    },
    'empire-main': {
        specialRuleText: [
            'This Battlefleet can include at most two **Airborne** units and at most one **Underwater** unit. Its **Flagship** and **Attachments** do not count toward either limit.',
        ],
        battlefleetBonus: {
            name: 'Jade Fury',
            text: 'While an opposing unit contains one or more models with the Hazard Critical Damage Effect, it is Burning. When a Burning unit activates, its Admiral must make a Group Crew Check. If failed, each model gains 1 Disorder. If a Burning model gains a fourth Disorder, it suffers 1 Damage and Disorder spreads as normal.',
        },
    },
    'empire-chita-swarm': {
        specialRuleText: [
            'This Battlefleet may include at most four **Underwater** units and cannot include **Airborne** units. Its **Flagship** and **Attachments** do not count toward these limits.',
            'The first Escort token purchased for each unit in this Battlefleet costs only 5 points, rather than 10.',
        ],
        battlefleetBonus: {
            name: 'Chita-Strike',
            text: 'When a **Japanese** unit in this Force declares an Attack action where all contributing weapons have both Submerged and Torpedo, this Admiral may declare a Chita-Strike. They may discard any number of Escort tokens from the attacking unit; each token adds 3 Action Dice. Each token also adds Breach (1) to one contributing weapon.',
        },
    },
    'empire-dragons-wrath': {
        specialRuleText: [
            'A **Tianlong Draconic Colossus** can be allocated to one of the Empire Draconic Elements even though this breaks the Flagship Limits and Duplicate Classes restrictions. A Battlefleet Doctrine cannot be purchased for this unit, even though it is a Flagship.',
        ],
        battlefleetBonus: {
            name: 'Their Will Made Manifest',
            text: 'Battle-ready **Draconic** models in this Force are Scoring Models.',
        },
    },
    'empire-gwisin-silent-strike': {
        specialRuleText: [
            'This Battlefleet cannot include **Underwater** or **Surface** units. If your Force contains a Zhanmadao Battlefleet, this Battlefleet does not take up one of your Specialist Battlefleet slots.',
        ],
        battlefleetBonus: {
            name: 'Cloud-Strike',
            text: 'At the start of each Round’s Launch Phase, this Admiral may launch a single stack of 4 Doksori Fighter tokens as if launched by a Carrier unit at the centre of the Play Area.',
        },
    },
    'empire-kagutsuchi-volcanic': {
        specialRuleText: [
            'This Battlefleet can include at most two **Airborne** units and at most two **Underwater** units. Its **Flagship** and **Attachments** do not count toward these limits.',
            'During Force Selection, models in this Battlefleet add Magma Cast Generator to their Generator options at +45 points. If a model already has a Magma Cast Generator option, its cost is unchanged. Its Flagship must have a Magma Cast Generator or Magma Tower Generator.',
        ],
        battlefleetBonus: {
            name: 'Monument of Fire',
            text: 'In the End Phase of each Round, during Complete Objectives, this Admiral may discard a Victory & Valour Card. If they do, they score Victory Points equal to the Mass of the largest Magma Formation wholly in their opponent’s half of the Play Area.',
        },
    },
    'empire-yamata-no-orochi': {
        specialRuleText: [
            'This Battlefleet cannot include **Airborne** or **Surface** units.',
        ],
        battlefleetBonus: {
            name: 'Abyssal Terror',
            text: 'When making an Attack action with an **Empire Underwater** unit with the Surfacing status, this Admiral may discard a Victory & Valour Card at the start of the Count Hits step. If they do, all Standard Counters in the Action Roll become Standard Strikes.',
        },
    },
    'empire-zhanmadao': {
        specialRuleText: [
            'This Battlefleet cannot include **Underwater** or **Surface** units.',
        ],
        battlefleetBonus: {
            name: 'Castles in the Sky',
            text: 'All **Empire Support Skyfortress** units in this Force gain Cloud Dive until the end of the first Round.',
        },
    },
    'imperium-main': {
        specialRuleText: [
            'This Battlefleet can include at most one **Airborne** unit and/or one **Underwater** unit. Its **Flagship** and **Attachments** do not count toward this limit.',
        ],
        battlefleetBonus: {
            name: 'Inductorium',
            text: 'When an **Imperium** unit declares an Attack action, it may attempt a Special Valour Effect after declaring contributing weapons. If successful, the Attack gains Blast (X), where X equals the number of contributing weapons with Arc (X) and/or Voltaic (X). Each Action Roll made against a Secondary Target gains 1 Bonus Die for each System Failure the model has.',
        },
    },
    'imperium-iron-skies': {
        battlefleetBonus: {
            name: 'Strategic Vantage',
            text: 'When determining Initiative at the start of the game, this Admiral may draw two Victory & Valour Cards and select the higher Value. When determining Initiative in later Ready Phases, if this Admiral chooses to Hold Their Nerve, they draw two Bonus Cards instead of one.',
        },
    },
    'imperium-ordo-teutonic': {
        specialRuleText: [
            'This Battlefleet’s **Flagship** must be a **Konig Generator Ship** or **Hochmeister Vitruvian Colossus** with the Teutonic Command upgrade.',
        ],
        battlefleetBonus: {
            name: 'Experimental Warfare',
            text: 'Once per Round, when making a Repair Roll for a unit in this Force with the **Teutonic Construct** property, this Admiral may re-roll every die that is not showing an Exploding Strike.',
        },
    },
    'imperium-scions-of-jutland': {
        specialRuleText: [
            'A Fleet Doctrine cannot be purchased for this Battlefleet’s **Flagship**. All units in this Battlefleet gain the **Scions of Jutland** trait if they do not already have it, and gain the Stoic property.',
        ],
        battlefleetBonus: {
            name: 'Pack Hunters',
            text: 'When making an Attack or Boarding action, a **Scions of Jutland** unit in this Force may re-roll Blanks or Counters in the Action Roll, up to the number of Negative Effect tokens on the Initial Target.',
        },
    },
    'sultanate-main': {
        specialRuleText: [
            'This Battlefleet can include at most one **Airborne** unit and/or one **Underwater** unit. Its **Flagship** and **Attachments** do not count toward this limit.',
        ],
        battlefleetBonus: {
            name: 'Superior Weaponry',
            text: 'Once per Round, when declaring Contributing Weapons for an Attack action made by a **Sultanate** unit in this Force, this Admiral can declare Superior Weaponry. For the duration of this Action, all Contributing weapons with Piercing (X), Precise (X), or Structural Failure (X) increase all Firepower values by the highest X value among those Qualities. Firepower values listed as "-" are unaffected.',
        },
    },
    'sultanate-allshard-order-aethernautic': {
        battlefleetBonus: {
            name: 'Aethernauts',
            text: 'If an **Order** unit from this Force Departs through a Portal, its Admiral can attempt to enact a Special Valour Effect at the end of the Movement Step. If denied, the unit returns to Reserve as normal. If successful, the unit is immediately Deployed through another Portal in the Play Area as though it had just arrived from Reserve.',
        },
    },
    'sultanate-balik-kartali': {
        battlefleetBonus: {
            name: 'Serpens Caput',
            text: 'Once per Round, when declaring Contributing Weapons for an Attack action made by an **Airborne Patrol** unit in this Force where the Initial Target is in the Fore arc of all Participating models, this Admiral can reveal and discard a Victory & Valour Card. If they do, add Bonus Dice to the Action Pool equal to the card Value.',
        },
    },
    'sultanate-crimson-league-privateers': {
        specialRuleText: [
            'A Fleet Doctrine cannot be purchased for this Battlefleet’s **Flagship**.',
            'All units in this Battlefleet gain the **Crimson League** trait.',
            'This is a **Mercenary Battlefleet** and can be fielded as a Specialist Battlefleet in a Force created using a different ORBAT. Its units must still be chosen from the Sultanate ORBAT, except for the optional Enlightened Automata unit.',
        ],
        battlefleetBonus: {
            name: 'Peer in Residence',
            text: 'Whenever this Battlefleet’s Admiral Activates a **Crimson League** unit in their Force, they can remove a single System Failure Critical Damage Effect from one Battle-Ready model in that unit.',
        },
    },
}

export function getBattlefleetDisplayInfo(definitionId: string): BattlefleetDisplayInfo {
    return displayInfo[definitionId] ?? {}
}
