import { ICharacterChoice } from 'planner-types/src/types/character-feature-customization-option';
import { CharacterFeature } from './character-feature';
import { ICharacterOptionWithPage } from './types';

export class CharacterFeatureCustomizable extends CharacterFeature {
    choices?: ICharacterChoice[];

    constructor(options: ICharacterOptionWithPage) {
        super(options);

        this.choices = options.choices;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            choices: this.choices,
        };
    }
}
