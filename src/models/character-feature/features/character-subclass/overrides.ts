import { ChoiceListConfig } from '../../types';

export interface SubclassFeatureOverrides {
    ignore?: true;
    choiceListConfig?: Partial<ChoiceListConfig>;
    redirectTo?: [number, string];
    disableTitleMatch?: true;
    // Allows matching section content of sections that also have an effect in the section title
    forceContentMatch?: true;
    choose?: number;
    chooseBullet?: true;
    optionName?: string;
}

type Overrides = Record<
    string,
    Record<number, Record<string | number, SubclassFeatureOverrides>>
>;

const Barbarian: Overrides = {
    'Wild Magic (barbarian subclass)': {
        3: {
            'Wild Magic Effects': {
                ignore: true,
            },
        },
        6: {
            'Bolstering Magic: Boon': {
                ignore: true,
            },
            'Bolstering Magic: Level 1 Spell Slot': {
                ignore: true,
            },
            'Bolstering Magic: Level 2 Spell Slot': {
                ignore: true,
            },
        },
        9: {
            'Bolstering Magic: Level 3 Spell Slot': {
                ignore: true,
            },
        },
    },
    Berserker: {
        3: {
            Frenzy: {
                forceContentMatch: true,
            },
        },
        6: {
            'Mindless Rage': {},
        },
    },
    Wildheart: {
        3: {
            // Bestial Heart is parsed anonymously as "Section 1" because of a weird HorizontalImageRule placement
            1: {
                optionName: 'Bestial Heart',
                choiceListConfig: {
                    name: 'Bestial Hearts',
                    feature: 'Grants',
                    matchAll: true,
                },
            },
        },
        10: {
            0: {
                redirectTo: [6, 'Animal Aspect'],
                optionName: 'Additional Animal Aspect',
            },
        },
    },
};

const Bard: Overrides = {
    'College of Swords': {
        3: {
            'Blade Flourish': {
                disableTitleMatch: true,
                forceContentMatch: true,
            },
        },
    },
};

const Cleric: Overrides = {
    'Nature Domain': {
        1: {
            'Acolyte of Nature': {
                forceContentMatch: true,
            },
        },
    },
    'Tempest Domain': {
        1: {
            'Wrath of the Storm': {
                disableTitleMatch: true,
            },
        },
    },
};

const Druid: Overrides = {
    'Circle of the Land': {
        2: {
            1: {
                optionName: 'Circle Cantrip',
            },
        },
        3: {
            0: {
                optionName: 'Circle Spells',
                choose: 1,
                chooseBullet: true,
            },
        },
        5: {
            0: {
                optionName: 'Circle Spells',
                choose: 1,
                chooseBullet: true,
            },
        },
        7: {
            0: {
                optionName: 'Circle Spells',
                choose: 1,
                chooseBullet: true,
            },
        },
        9: {
            0: {
                optionName: 'Circle Spells',
                choose: 1,
                chooseBullet: true,
            },
        },
    },
};

const Fighter: Overrides = {
    'Battle Master': {
        3: {
            Manoeuvres: {
                choiceListConfig: {
                    feature: 'Grants',
                    name: 'Manoeuvres',
                    matchAll: true,
                },
                choose: 3,
            },
        },
        7: {
            Manoeuvres: {
                redirectTo: [3, 'Manoeuvres'],
                choose: 2,
            },
        },
        10: {
            Manoeuvres: {
                redirectTo: [3, 'Manoeuvres'],
                choose: 2,
            },
        },
    },
    'Eldritch Knight': {
        3: {
            2: { optionName: 'Eldritch Knight Cantrips' },
            3: { optionName: 'Eldritch Knight Spells' },
            4: { optionName: 'Wizard Spells' },
        },
        7: {
            2: { optionName: 'Eldritch Knight Spells' },
        },
        8: { 0: { optionName: 'Wizard Spells' } },
    },
};

const Rogue: Overrides = {
    'Gloom Stalker': {
        3: {
            'Dread Ambusher': {
                forceContentMatch: true,
            },
        },
    },
    'Arcane Trickster': {
        3: {
            2: { optionName: 'Arcane Trickster Cantrips' },
            3: { optionName: 'Arcane Trickster Spells' },
            4: { optionName: 'Wizard Spells' },
        },
        7: { 1: { optionName: 'Arcane Trickster Spells' } },
        8: { 0: { optionName: 'Wizard Spells' } },
    },
};

const Sorcerer: Overrides = {
    'Draconic Bloodline': {
        1: {
            'Draconic Ancestry (Choose 1)': {
                optionName: 'Draconic Ancestry',
                choiceListConfig: {
                    feature2: 'Grants',
                },
            },
        },
    },
    'Storm Sorcery': {
        6: {
            'Heart of the Storm': {
                disableTitleMatch: true,
                forceContentMatch: true,
            },
        },
    },
};

const Wizard: Overrides = {
    'Necromancy School': {
        6: {
            'Undead Thralls: Animate Dead': {
                disableTitleMatch: true,
                forceContentMatch: true,
            },
        },
    },
};

export const characterSubclassParserOverrides: Overrides = {
    ...Barbarian,
    ...Bard,
    ...Cleric,
    ...Druid,
    ...Fighter,
    ...Rogue,
    ...Sorcerer,
    ...Wizard,
};
