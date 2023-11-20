import {
    CharacterPlannerStep,
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
import { MediaWikiTemplate } from '../media-wiki/media-wiki-template';
import { MediaWikiParser } from '../media-wiki/wikitext-parser';
import { IClassFeatureFactory } from './class-feature/types';

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

    static factory?: IClassFeatureFactory;

    constructor(
        { pageTitle, page, name, image }: ICharacterOptionWithPage,
        public level?: number,
    ) {
        super({ pageTitle, page });

        this.name = name;

        this.initialized[CharacterFeatureLoadingStates.EFFECTS] =
            this.initOptionsAndEffects().catch(error);

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
    }

    toJSON() {
        return {
            name: this.name,
            description: this.description,
            image: this.image,
            grants: this.grants,
            choices: this.choices,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    async initDescription(): Promise<void> {
        // // Default description, should be overridden by subclass if possible
        // await this.initialized[CharacterFeatureLoadingStates.EFFECTS];
        // if (
        //     (!this.choices || this.choices.length === 0) &&
        //     this.grants.length === 1
        // ) {
        //     this.description = (this.grants[0] as any)?.description;
        // }
    }

    // eslint-disable-next-line class-methods-use-this
    async initImage(): Promise<void> {
        // // Default image, should be overridden by subclass if possible
        // await this.initialized[CharacterFeatureLoadingStates.EFFECTS];
        // if (
        //     (!this.choices || this.choices.length === 0) &&
        //     this.grants.length === 1
        // ) {
        //     this.image = (this.grants[0] as any)?.image;
        // }
    }

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
                ? MediaWikiParser.stripMarkup(descMatch[1]).trim()
                : undefined,
            image: imageMatch ? imageMatch[1].trim() : undefined,
        };
    }

    static async parsePageForGrantableEffect(
        pageTitle: string,
    ): Promise<GrantableEffect | StaticallyReferenceable | null>;

    static async parsePageForGrantableEffect(
        page: PageData,
    ): Promise<GrantableEffect | StaticallyReferenceable | null>;

    static async parsePageForGrantableEffect(
        pageOrTitle: string | PageData,
    ): Promise<GrantableEffect | StaticallyReferenceable | null> {
        let page: PageData | undefined;

        try {
            if (typeof pageOrTitle === 'string') {
                const pageTitle = pageOrTitle.replace(/_/g, ' ');
                page = await MediaWiki.getPage(pageTitle);
            } else {
                page = pageOrTitle;
            }

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
                `failed to parse description and image for '${page.title}'`,
            );
        } catch (e) {
            if (e instanceof PageNotFoundError) {
                warn(
                    `Could not find page '${page?.title}' when parsing for grantable effects.`,
                );
            } else {
                // throw e;
            }
        }

        return null;
    }

    protected static async isPassiveOption(page: PageData): Promise<boolean> {
        // Some pages use the "Passive feature page" template but are really a choice that grants other GrantableEffects
        const { plainText } = MediaWikiTemplate.Parsers;

        try {
            const template = await page.getTemplate('Passive feature page');

            const { summary, description } = template.parse({
                summary: { parser: plainText, default: '' },
                description: { parser: plainText, default: '' },
            });

            return [summary, description].some((text) =>
                text.match(/\W(?:choices?)|(?:choose)\W/i),
            );
        } catch (err) {
            // template not found
            return false;
        }
    }

    protected static async parseChoiceList(
        sectionWikitext: string,
        pageTitle: string,
    ): Promise<ICharacterOptionWithStubs[]> {
        const match = sectionWikitext.match(
            /{\|\s*class="wikitable.*?"[\s\S]+?\|}/,
        );

        if (!match) {
            throw new Error(`Could not find wikitable for page '${pageTitle}'`);
        }

        const tableWikitext = match[0];
        const table = MediaWikiParser.parseWikiTable(tableWikitext, '2d');

        if (table.length <= 1 || table[0].length <= 1) {
            error(
                `Something went wrong parsing wikitable on page '${pageTitle}'`,
            );
        }

        const features: ICharacterOptionWithStubs[] = await Promise.all(
            table.map(async (row) => {
                const firstCell = row[0];

                const featureMatch =
                    firstCell.match(/{{(Icon|SAI|SmIconLink)\|[^}]+}}/) ??
                    firstCell.match(/\[\[[^\]]+?\]\]/);

                if (!featureMatch?.[0]) {
                    throw new Error();
                }

                return this.factory!.fromWikitext(featureMatch[0]);
            }),
        );

        return features;
    }

    protected static async parsePageForChoice(
        page: PageData,
    ): Promise<ICharacterChoiceWithStubs | null> {
        const listSection = page.getSection('List of [\\w\\s]+?');

        let options: ICharacterOptionWithStubs[] = [];

        if (listSection) {
            options = await this.parseChoiceList(
                listSection.content,
                page.title,
            );
        }

        if (options.length === 0) {
            return null;
        }

        return {
            type: CharacterPlannerStep.CLASS_FEATURE_SUBCHOICE,
            options,

            // TODO
            // count: 1
        };
    }

    static async initOptionsAndEffects(page: PageData): Promise<{
        effect: GrantableEffect | StaticallyReferenceable | null;
        choice: ICharacterChoiceWithStubs | null;
    }> {
        const isGrantableEffect = page.hasCategory([
            'Class actions',
            'Racial action',
            'Passive features',
            'Spells',
            'Toggleable passive features',
        ]);

        let effect: GrantableEffect | StaticallyReferenceable | null = null;
        let choice: ICharacterChoiceWithStubs | null = null;

        if (isGrantableEffect) {
            if (await CharacterFeature.isPassiveOption(page)) {
                choice = await CharacterFeature.parsePageForChoice(page);
            } else {
                effect =
                    await CharacterFeature.parsePageForGrantableEffect(page);
            }
        } else if (page.hasCategory('Class features')) {
            choice = await CharacterFeature.parsePageForChoice(page);
        }

        return { effect, choice };
    }

    async initOptionsAndEffects(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            return;
        }

        const { effect, choice } = await CharacterFeature.initOptionsAndEffects(
            this.page,
        );

        if (effect) {
            this.grants.push(effect);
        }

        if (choice) {
            if (!this.choices) {
                this.choices = [];
            }

            this.choices.push(choice);
        }
    }
}
