import { ICharacterFeatureCustomizationOption } from 'planner-types/src/types/character-feature-customization-option';
import { PageItem } from '../page-item';
import { ICharacterFeatureCustomizationOptionWithPage } from './types';
import { error } from '../logger';

enum CharacterFeatureLoadingStates {
    DESCRIPTION = 'DESCRIPTION',
    IMAGE = 'IMAGE',
}

export class CharacterFeature
    extends PageItem
    implements ICharacterFeatureCustomizationOption
{
    name: string;
    description?: string;
    image?: string;

    constructor({
        pageTitle,
        page,
        name,
        image,
    }: ICharacterFeatureCustomizationOptionWithPage) {
        super({ pageTitle, page });

        this.name = name;

        if (image) {
            this.image = image;
        } else {
            this.initialized[CharacterFeatureLoadingStates.IMAGE] =
                this.initImage().catch(error);
        }

        this.initialized[CharacterFeatureLoadingStates.DESCRIPTION] =
            this.initDescription().catch(error);
    }

    toJSON() {
        return {
            name: this.name,
            description: this.description,
            image: this.image,
        };
    }

    static parseNameFromPageTitle(title: string) {
        return title.split('(')[0].trim();
    }

    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-empty-function
    async initDescription(): Promise<void> {}

    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-empty-function
    async initImage(): Promise<void> {}
}
