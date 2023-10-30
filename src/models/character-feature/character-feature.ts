import { ICharacterOptionWithStubs } from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import {
    GrantableEffect,
    GrantableEffectType,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import {
    IAction,
    ISpell,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/action';
import { CompressableRecord } from '@jorgenswiderski/tomekeeper-shared/dist/models/compressable-record/types';
import { PageItem, PageLoadingState } from '../page-item';
import { ICharacterOptionWithPage } from './types';
import { error, warn } from '../logger';
import { MwnApi } from '../../api/mwn';
import { MediaWiki, PageData } from '../media-wiki';
import { PageNotFoundError } from '../errors';
import { getSpellDataById } from '../action/spell';
import { getActionDataById } from '../action/action';
import { SpellStub } from '../static-reference/spell-stub';
import { ActionStub } from '../static-reference/action-stub';

enum CharacterFeatureLoadingStates {
    DESCRIPTION = 'DESCRIPTION',
    IMAGE = 'IMAGE',
    EFFECTS = 'EFFECTS',
}

export class CharacterFeature
    extends PageItem
    implements ICharacterOptionWithStubs
{
    name: string;
    description?: string;
    image?: string;
    grants: (GrantableEffect | CompressableRecord)[] = [];

    constructor(
        { pageTitle, page, name, image }: ICharacterOptionWithPage,
        public level?: number,
    ) {
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

    private static async parseActionPage(
        pageContent: string,
        pageTitle: string,
        pageId: number,
        categories: string[],
    ): Promise<GrantableEffect | CompressableRecord> {
        const descMatch =
            /\|\s*description\s*=\s*([\s\S]+?)\n\|\s*[\w\s]+=/g.exec(
                pageContent,
            );
        const imageMatch = /\|\s*image\s*=\s*(.+)/.exec(pageContent);

        const effectType =
            categories.includes('Category:Passive Features') ||
            categories.includes('Category:Toggleable Passive Features')
                ? GrantableEffectType.CHARACTERISTIC
                : GrantableEffectType.ACTION;

        if (effectType === GrantableEffectType.ACTION) {
            if (pageContent.includes('{{SpellPage')) {
                const spells = await getSpellDataById();

                if (!spells.has(pageId)) {
                    error(`Could not find spell for ${pageTitle} (${pageId})`);
                } else {
                    const spell = spells.get(pageId)! as ISpell;

                    return new SpellStub(spell);
                }
            }

            if (pageContent.includes('{{ActionPage')) {
                const actions = await getActionDataById();

                if (!actions.has(pageId)) {
                    error(`Could not find action for ${pageTitle} (${pageId})`);
                } else {
                    const action = actions.get(pageId)! as IAction;

                    return new ActionStub(action);
                }
            }
        }

        return {
            // name: CharacterFeature.parseNameFromPageTitle(pageTitle),
            name: pageTitle,
            type: effectType,
            description: descMatch
                ? MediaWiki.stripMarkup(descMatch[1]).trim()
                : undefined,
            image: imageMatch ? imageMatch[1].trim() : undefined,
        };
    }

    static async parsePageForGrantableEffect(
        pageTitle: string,
        page?: PageData,
    ): Promise<GrantableEffect | CompressableRecord | null> {
        try {
            const categories = await MwnApi.queryCategoriesFromPage(pageTitle);

            if (
                !categories.includes('Category:Class Actions') &&
                !categories.includes('Category:Racial Action') &&
                !categories.includes('Category:Passive Features') &&
                !categories.includes('Category:Spells') &&
                !categories.includes('Category:Toggleable Passive Features')
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
                page.content.includes('{{ActionPage') ||
                page.content.includes('{{SpellPage') ||
                page.content
            ) {
                // uses the ActionPage template, could be either an action or a passive
                return await CharacterFeature.parseActionPage(
                    page.content,
                    pageTitle,
                    page.pageId,
                    categories,
                );
            }

            throw new Error(
                `failed to parse description and image for '${pageTitle}'`,
            );

            // return {
            //     name: CharacterFeature.parseNameFromPageTitle(pageTitle),
            //     type: GrantableEffectType.CHARACTERISTIC,
            // };
        } catch (e) {
            if (e instanceof PageNotFoundError) {
                warn(
                    `Could not find page ${pageTitle} when parsing for grantable effects.`,
                );
            } else {
                throw e;
            }
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
