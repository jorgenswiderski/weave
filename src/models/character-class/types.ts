import { ICharacterOptionWithStubs } from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { PageItem } from '../page-item';

export interface CharacterProgressionLevel {
    Level: number;
    Features: ICharacterOptionWithStubs[];
}

export interface CharacterClassProgressionLevel
    extends CharacterProgressionLevel {
    'Proficiency Bonus': number;
    'Spell Slots': number[];
    'Cantrips Known'?: number;
    // [key: string]: number | string | undefined;
}

export type CharacterClassProgression = CharacterClassProgressionLevel[];

export interface ICharacterClass extends PageItem {
    name: string;
}
