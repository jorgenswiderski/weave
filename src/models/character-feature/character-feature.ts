import {
    ICharacterChoiceWithStubs,
    ICharacterOptionWithStubs,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import {
    GrantableEffect,
    GrantableEffectType,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import {
    IAction,
    ISpell,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/action';
import { StaticallyReferenceable } from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/types';
import assert from 'assert';
import { PageItem, PageLoadingState } from '../page-item';
import { ICharacterOptionWithPage } from './types';
import { error, warn } from '../logger';
import { MediaWiki, PageData } from '../media-wiki/media-wiki';
import { PageNotFoundError } from '../errors';
import { Spell, getSpellDataById } from '../action/spell';
import { Action, getActionDataById } from '../action/action';
import { SpellStub } from '../static-reference/spell-stub';
import { ActionStub } from '../static-reference/action-stub';
import { StaticImageCacheService } from '../static-image-cache-service';

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
    grants: (GrantableEffect | StaticallyReferenceable)[] = [];
    choices?: ICharacterChoiceWithStubs[];

    constructor(
        { pageTitle, page, name, image }: ICharacterOptionWithPage,
        public level?: number,
    ) {
        super({ pageTitle, page });

        this.name = name;

        if (image) {
            this.image = image;

            if (this.image) {
                StaticImageCacheService.cacheImage(this.image);
            }
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

    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-empty-function
    async initDescription(): Promise<void> {}

    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-empty-function
    async initImage(): Promise<void> {}

    private static async parseSpellPage(
        page: PageData,
    ): Promise<StaticallyReferenceable> {
        const { title, pageId } = page;
        assert(await page.hasTemplate('SpellPage'));

        const spells = await getSpellDataById();

        if (!spells.has(pageId)) {
            throw new Error(`Could not find spell for ${title} (${pageId})`);
        }

        const spell = spells.get(pageId)! as Spell;
        spell.markUsed();

        return new SpellStub(spell as ISpell);
    }

    private static async parseActionPage(
        page: PageData,
    ): Promise<StaticallyReferenceable> {
        const { title, pageId } = page;
        assert(await page.hasTemplate('ActionPage'));

        const actions = await getActionDataById();

        if (!actions.has(pageId)) {
            throw new Error(`Could not find action for ${title} (${pageId})`);
        }

        const action = actions.get(pageId)! as Action;
        action.markUsed();

        return new ActionStub(action as IAction);
    }

    private static async parsePassiveFeaturePage(
        page: PageData & { content: string },
    ): Promise<GrantableEffect> {
        const { title, content } = page;
        assert(await page.hasTemplate('Passive feature page'));

        const descMatch =
            /\|\s*description\s*=\s*([\s\S]+?)\n\|\s*[\w\s]+=/g.exec(content);

        const imageMatch = /\|\s*image\s*=\s*(.+)/.exec(content);

        return {
            // name: MediaWikiWikitextParser.parseNameFromPageTitle(pageTitle),
            name: title,
            type: GrantableEffectType.CHARACTERISTIC,
            description: descMatch
                ? MediaWiki.stripMarkup(descMatch[1]).trim()
                : undefined,
            image: imageMatch ? imageMatch[1].trim() : undefined,
        };
    }

    static async parsePageForGrantableEffect(
        pageTitle: string,
        page?: PageData,
    ): Promise<GrantableEffect | StaticallyReferenceable | null> {
        try {
            // eslint-disable-next-line no-param-reassign
            pageTitle = pageTitle.replace(/_/g, ' ');
            // eslint-disable-next-line no-param-reassign
            page = page ?? (await MediaWiki.getPage(pageTitle));

            if (!page?.content) {
                throw new Error('no page content for grantable effect');
            }

            if (
                !page.hasCategory([
                    'Class actions',
                    'Racial action',
                    'Passive features',
                    'Spells',
                    'Toggleable passive features',
                ])
            ) {
                return null;
            }

            if (await page.hasTemplate('ActionPage')) {
                return await CharacterFeature.parseActionPage(page);
            }

            if (await page.hasTemplate('SpellPage')) {
                return await CharacterFeature.parseSpellPage(page);
            }

            if (await page.hasTemplate('Passive feature page')) {
                return await CharacterFeature.parsePassiveFeaturePage(
                    page as PageData & { content: string },
                );
            }

            throw new Error(
                `failed to parse description and image for '${pageTitle}'`,
            );
        } catch (e) {
            if (e instanceof PageNotFoundError) {
                warn(
                    `Could not find page ${pageTitle} when parsing for grantable effects.`,
                );
            } else {
                // throw e;
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
