import { ICharacterFeatureCustomizationOption } from 'planner-types/src/types/character-feature-customization-option';
import { PageItem } from '../page-item';
import { ICharacterFeatureCustomizationOptionWithPage } from './types';

export class CharacterFeature
    extends PageItem
    implements ICharacterFeatureCustomizationOption
{
    name: string;
    description?: string;
    image?: string;

    constructor({
        pageTitle,
        name,
        image,
    }: ICharacterFeatureCustomizationOptionWithPage) {
        super(pageTitle);

        this.name = name;
        this.image = image;
    }

    toJSON() {
        return {
            name: this.name,
            description: this.description,
            image: this.image,
        };
    }
}
