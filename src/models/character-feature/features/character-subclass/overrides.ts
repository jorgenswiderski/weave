import { ChoiceListConfig } from '../../types';

type Overrides = Record<
    string,
    Record<
        number,
        Record<
            string,
            {
                ignore?: true;
                choiceListConfig?: Partial<ChoiceListConfig>;
                redirectTo?: [number, string];
                disableTitleMatch?: true;
                // Allows matching section content of sections that also have an effect in the section title
                forceContentMatch?: true;
                choose?: number;
            }
        >
    >
>;

const Barbarian: Overrides = {
    'Wild Magic (Barbarian Subclass)': {
        3: {
            'Wild Magic Effects': {
                ignore: true,
            },
        },
        6: {
            'Bolstering Magic': {
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
    },
    Wildheart: {
        3: {
            'Bestial Heart': {
                choiceListConfig: {
                    name: 'Bestial Hearts',
                    feature: 'Grants',
                    matchAll: true,
                },
            },
        },
        10: {
            'Additional Animal Aspect': {
                redirectTo: [6, 'Animal Aspect'],
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

const Fighter: Overrides = {
    'Battle Master': {
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
};

const Rogue: Overrides = {
    'Gloom Stalker': {
        3: {
            'Dread Ambusher': {
                forceContentMatch: true,
            },
        },
    },
};

const Sorcerer: Overrides = {
    'Draconic Bloodline': {
        1: {
            'Draconic Ancestry (Choose 1)': {
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
    ...Cleric,
    ...Fighter,
    ...Rogue,
    ...Sorcerer,
    ...Wizard,
};
