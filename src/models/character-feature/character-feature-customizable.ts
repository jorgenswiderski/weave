import {
    CharacterPlannerStep,
    ICharacterFeatureCustomizationOption,
} from 'planner-types/src/types/character-feature-customization-option';
import { CharacterFeature } from './character-feature';
import { ICharacterFeatureCustomizationOptionWithPage } from './types';

interface CharacterFeatureCustomizableProps
    extends ICharacterFeatureCustomizationOptionWithPage {
    choiceType: CharacterPlannerStep;
}

export class CharacterFeatureCustomizable extends CharacterFeature {
    choiceType: CharacterPlannerStep;
    choices?: ICharacterFeatureCustomizationOption[][];

    constructor(options: CharacterFeatureCustomizableProps) {
        super(options);

        this.choiceType = options.choiceType;
        this.choices = options.choices;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            choiceType: this.choiceType,
            choices: this.choices,
        };
    }
}
