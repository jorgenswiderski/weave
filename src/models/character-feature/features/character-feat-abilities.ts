import {
    CharacterPlannerStep,
    ICharacterFeatureCustomizationOption,
} from 'planner-types/src/types/character-feature-customization-option';
import { CharacterFeature } from '../character-feature';
import { ICharacterFeatureCustomizationOptionWithPage } from '../types';

export class CharacterFeatAbilities extends CharacterFeature {
    choices?: ICharacterFeatureCustomizationOption[][];

    constructor(
        option: ICharacterFeatureCustomizationOptionWithPage,
        public abilities: string[],
        public points: number,
    ) {
        super(option);

        this.initChoices();
    }

    initChoices(): void {
        this.choices = [
            this.abilities.map((ability) => ({
                name: ability,
            })),
        ];
    }

    toJSON() {
        const data = super.toJSON();

        return {
            ...data,
            choices: this.choices,
            choiceType: CharacterPlannerStep.FEAT_ABILITY_SCORES,
            points: this.points,
        };
    }
}
