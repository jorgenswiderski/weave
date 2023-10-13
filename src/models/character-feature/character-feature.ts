import { ICharacterFeatureCustomizationOption } from 'planner-types/src/types/character-feature-customization-option';
import {
    GrantableEffect,
    GrantableEffectType,
} from 'planner-types/src/types/grantable-effect';
import { PageItem, PageLoadingState } from '../page-item';
import { ICharacterFeatureCustomizationOptionWithPage } from './types';
import { error } from '../logger';
import { MwnApi } from '../../api/mwn';
import { MediaWiki, PageData } from '../media-wiki';

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
    grants: GrantableEffect[] = [];

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

    private static parseActionPage(
        pageContent: string,
        pageTitle: string,
        categories: string[],
    ): GrantableEffect {
        const descMatch =
            /\|\s*description\s*=\s*([\s\S]+?)\n\|\s*[\w\s]+=/g.exec(
                pageContent,
            );
        const imageMatch = /\|\s*image\s*=\s*(.+)/.exec(pageContent);

        return {
            // name: CharacterFeature.parseNameFromPageTitle(pageTitle),
            name: pageTitle,
            type: categories.includes('Category:Passive Features')
                ? GrantableEffectType.CHARACTERISTIC
                : GrantableEffectType.ACTION,
            description: descMatch
                ? MediaWiki.stripMarkup(descMatch[1]).trim()
                : undefined,
            image: imageMatch
                ? MediaWiki.getImagePath(imageMatch[1].trim())
                : undefined,
        };
    }

    static async parsePageForGrantableEffect(
        pageTitle: string,
        page?: PageData,
    ): Promise<GrantableEffect | null> {
        const categories = await MwnApi.queryCategoriesFromPage(pageTitle);

        if (
            !categories.includes('Category:Class Actions') &&
            !categories.includes('Category:Racial Actions') &&
            !categories.includes('Category:Passive Features')
        ) {
            return null;
        }

        if (!page) {
            const p = await MediaWiki.getPage(pageTitle);

            if (p) {
                // eslint-disable-next-line no-param-reassign
                page = p;
            }
        }

        if (!page?.content) {
            throw new Error('no page content for grantable effect');
        }

        if (
            categories.includes('Category:Class Actions') ||
            categories.includes('Category:Racial Action')
        ) {
            // uses the ActionPage template, could be either an action or a passive
            return CharacterFeature.parseActionPage(
                page.content,
                pageTitle,
                categories,
            );
        }

        if (categories.includes('Category:Passive Features')) {
            throw new Error(
                `failed to parse description and image for '${pageTitle}'`,
            );

            return {
                name: CharacterFeature.parseNameFromPageTitle(pageTitle),
                type: GrantableEffectType.CHARACTERISTIC,
            };
        }

        return null;
    }

    async initGrantableEffects(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.pageTitle) {
            return;
        }

        const fx = await CharacterFeature.parsePageForGrantableEffect(
            this.pageTitle,
            this.page,
        );

        if (fx) {
            this.grants.push(fx);
        }
    }
}
