import { ICharacterFeatureCustomizationOption } from 'planner-types/src/types/character-feature-customization-option';
import {
    GrantableEffect,
    GrantableEffectType,
} from 'planner-types/src/types/grantable-effect';
import { PageItem } from '../page-item';
import { ICharacterFeatureCustomizationOptionWithPage } from './types';
import { error } from '../logger';
import { MwnApi } from '../../api/mwn';

enum CharacterFeatureLoadingStates {
    DESCRIPTION = 'DESCRIPTION',
    IMAGE = 'IMAGE',
    EFFECTS = 'EFFECTS',
}

export class CharacterFeature
    extends PageItem
    implements ICharacterFeatureCustomizationOption
{
    name: string;
    description?: string;
    image?: string;
    grants?: GrantableEffect[];

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

        this.initialized[CharacterFeatureLoadingStates.EFFECTS] =
            this.initGrantableEffects().catch(error);
    }

    toJSON() {
        return {
            name: this.name,
            description: this.description,
            image: this.image,
            grants: this.grants,
        };
    }

    static parseNameFromPageTitle(title: string) {
        return title.split('(')[0].trim();
    }

    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-empty-function
    async initDescription(): Promise<void> {}

    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-empty-function
    async initImage(): Promise<void> {}

    async initGrantableEffects(): Promise<void> {
        if (!this.pageTitle) {
            return;
        }

        const categories = await MwnApi.queryCategoriesFromPage(this.pageTitle);

        const grants: GrantableEffect[] = [];

        if (categories.includes('Category:Passive Features')) {
            grants.push({
                name: this.name,
                type: GrantableEffectType.CHARACTERISTIC,
            });
        } else if (categories.includes('Category:Class Actions')) {
            grants.push({
                name: this.name,
                type: GrantableEffectType.ACTION,
            });
        }

        if (grants) {
            this.grants = grants;
        }
    }
}
