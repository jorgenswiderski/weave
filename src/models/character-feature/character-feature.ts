import {
    CharacterPlannerStep,
    ICharacterChoiceWithStubs,
    ICharacterOptionWithStubs,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import {
    GrantableEffect,
    IPassive,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import {
    IAction,
    ISpell,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/action';
import { StaticallyReferenceable } from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/types';
import assert from 'assert';
import { PageItem, PageLoadingState } from '../page-item';
import {
    CharacterFeatureDataNotFoundError,
    ChoiceListConfig,
    ICharacterOptionWithPage,
} from './types';
import { error, warn } from '../logger';
import { MediaWiki, PageData } from '../media-wiki/media-wiki';
import { PageNotFoundError } from '../errors';
import { Spell, getSpellDataById } from '../action/spell';
import { Action } from '../action/action';
import { SpellStub } from '../static-reference/spell-stub';
import { ActionStub } from '../static-reference/action-stub';
import { StaticImageCacheService } from '../static-image-cache-service';
import { MediaWikiTemplate } from '../media-wiki/media-wiki-template';
import { MediaWikiParser } from '../media-wiki/media-wiki-parser';
import { IClassFeatureFactory } from './class-feature/types';
import { WikitableNotFoundError } from '../media-wiki/types';
import { ICharacterClass } from '../character-class/types';
import { choiceListConfigs } from './choice-list-configs';
import { PassiveStub } from '../static-reference/passive-stub';
import { getPassiveDataById } from '../passive/passive';
import { getActionDataById } from '../action/init';

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
        public characterClass?: ICharacterClass,
        public subclass?: ICharacterOptionWithStubs,
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

    toJSON(): any {
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

    private static async parseSpellPage(page: PageData): Promise<SpellStub> {
        const { title, pageId } = page;
        assert(await page.hasTemplate('SpellPage'));

        const spells = await getSpellDataById();

        if (!spells.has(pageId)) {
            throw new CharacterFeatureDataNotFoundError(
                `Could not find spell for ${title} (${pageId})`,
            );
        }

        const spell = spells.get(pageId)! as Spell;
        spell.markUsed();

        return new SpellStub(spell as ISpell);
    }

    private static async parseActionPage(page: PageData): Promise<ActionStub> {
        const { title, pageId } = page;
        assert(await page.hasTemplate(['ActionPage', 'WeaponActionPage']));

        const actions = await getActionDataById();

        if (!actions.has(pageId)) {
            throw new CharacterFeatureDataNotFoundError(
                `Could not find action for ${title} (${pageId})`,
            );
        }

        const action = actions.get(pageId)! as Action;
        action.markUsed();

        return new ActionStub(action as IAction);
    }

    private static async parsePassiveFeaturePage(
        page: PageData & { content: string },
    ): Promise<PassiveStub> {
        const { title, pageId } = page;
        assert(await page.hasTemplate('Passive feature page'));
        const passive = getPassiveDataById().get(pageId);

        if (!passive) {
            throw new CharacterFeatureDataNotFoundError(
                `Could not find passive for ${title} (${pageId})`,
            );
        }

        passive.markUsed();

        return new PassiveStub(passive as IPassive);
    }

    static async parsePageForGrantableEffect(
        pageTitle: string,
    ): Promise<GrantableEffect | ActionStub | SpellStub | PassiveStub | null>;

    static async parsePageForGrantableEffect(
        page: PageData,
    ): Promise<GrantableEffect | ActionStub | SpellStub | PassiveStub | null>;

    static async parsePageForGrantableEffect(
        pageOrTitle: string | PageData,
    ): Promise<GrantableEffect | ActionStub | SpellStub | PassiveStub | null> {
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
                    'Actions',
                    'Bonus actions',
                    'Reactions',
                    'Free actions',
                    'Movement-expending actions',
                    'Class actions',

                    'Passive features',
                    'Toggleable passive features',
                ])
            ) {
                return null;
            }

            if (await page.hasTemplate(['ActionPage', 'WeaponActionPage'])) {
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
            } else if (e instanceof CharacterFeatureDataNotFoundError) {
                error(e.message);
            } else {
                error(e);
            }
        }

        return null;
    }

    protected async isPassiveOption(): Promise<boolean> {
        if (!this.page) {
            throw new PageNotFoundError();
        }

        // Some pages use the "Passive feature page" template but are really a choice that grants other GrantableEffects
        const { plainText } = MediaWikiTemplate.Parsers;

        try {
            const template = await this.page.getTemplate(
                'Passive feature page',
            );

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

    choiceListConfig: ChoiceListConfig = {
        feature: 0,
    };

    choiceListCount = 1;

    protected async parseChoiceList(
        sectionWikitext: string,
        pageTitle: string,
        extraConfig: Partial<ChoiceListConfig> = {},
    ): Promise<ICharacterOptionWithStubs[]> {
        let table;

        try {
            table = MediaWikiParser.parseWikiTable(sectionWikitext, 'both');
        } catch (err) {
            if (err instanceof WikitableNotFoundError) {
                err.message = `Could not find wikitable for page '${pageTitle}'`;
            }

            throw err;
        }

        const config: ChoiceListConfig = {
            ...(choiceListConfigs.get(pageTitle) ?? this.choiceListConfig),
            ...extraConfig,
        };

        const features: ICharacterOptionWithStubs[] = (
            await Promise.all(
                table
                    .filter((row, index) => {
                        if (config.minLevel) {
                            const ml = parseInt(row[config.minLevel], 10);

                            assert(
                                !Number.isNaN(ml),
                                `Failed to parse minLevel value '${
                                    row[config.minLevel]
                                }' in row ${index} of wikitable on page '${
                                    this.pageTitle
                                }'`,
                            );

                            assert(
                                this.level,
                                `Level must be defined to enforce minLevel constraint on wikitable on page '${this.pageTitle}'`,
                            );

                            if (this.level! < ml) {
                                return false;
                            }
                        }

                        if (config.classRestricted) {
                            assert(
                                this.characterClass,
                                `Class must be defined to enforce classes constraint on wikitable on page '${this.pageTitle}'`,
                            );

                            const classCell = row?.[this.characterClass.name];

                            const isClassAllowed =
                                classCell && classCell.trim() === '✓';

                            return isClassAllowed;
                        }

                        return true;
                    })
                    .map(async (row) => {
                        const featureCells = [row[config.feature]];

                        if (config.feature2) {
                            featureCells.push(row[config.feature2]);
                        }

                        const featureTitles = featureCells.flatMap(
                            (featureCell) =>
                                [
                                    ...featureCell.matchAll(
                                        /{{(?:Icon|SAI|SmIconLink|Pass)\|([^|}]+).*?}}/g,
                                    ),
                                    ...featureCell.matchAll(
                                        /\[\[([^|\]]+).*?\]\]/g,
                                    ),
                                ]
                                    .map(([, title]) => title)
                                    .slice(0, config.matchAll ? undefined : 1),
                        );

                        if (featureTitles.length === 0) {
                            throw new Error(
                                `Could not find feature at row key ${config.feature} in wikitable on page '${pageTitle}'`,
                            );
                        }

                        const effects = (
                            await Promise.all(
                                featureTitles.map((title) =>
                                    CharacterFeature.parsePageForGrantableEffect(
                                        title,
                                    ),
                                ),
                            )
                        ).filter(Boolean) as (
                            | GrantableEffect
                            | StaticallyReferenceable
                        )[];

                        const name = config.name
                            ? MediaWikiParser.stripMarkup(row[config.name])
                            : featureTitles[0];

                        return {
                            name: MediaWikiParser.parseNameFromPageTitle(name),
                            grants: effects,
                        };
                    }),
            )
        ).flat();

        return features;
    }

    protected hasChoiceSections(): boolean {
        if (!this.page) {
            throw new PageNotFoundError();
        }

        const matches = [
            ...this.page.content.matchAll(
                /\n\s*={2,}\s*{{(Icon|SAI|SmIconLink|Pass)\|[^}]+}}\s*={2,}\s*\n/g,
            ),
        ];

        return matches.length > 1;
    }

    protected async parseChoiceSections(): Promise<
        ICharacterOptionWithStubs[]
    > {
        if (!this.page) {
            throw new PageNotFoundError();
        }

        const featureMarkdown = [
            ...this.page.content.matchAll(
                /\n\s*={2,}\s*({{(Icon|SAI|SmIconLink|Pass)\|[^}]+}})\s*={2,}\s*\n/g,
            ),
        ].map((match) => match[1]);

        return (
            await Promise.all(
                featureMarkdown.map((md) =>
                    CharacterFeature.factory!.fromWikitext(md),
                ),
            )
        ).filter(Boolean) as ICharacterOptionWithStubs[];
    }

    // To be overridden by special features like CharacterFeatureMetamagic
    protected getChoiceCount(): number {
        return this.choiceListCount;
    }

    protected async parsePageForChoice(): Promise<ICharacterChoiceWithStubs | null> {
        if (!this.page) {
            throw new PageNotFoundError();
        }

        const listSection = this.page.getSection('List of [\\w\\s]+?');

        let options: ICharacterOptionWithStubs[] = [];

        if (listSection) {
            options = await this.parseChoiceList(
                listSection.content,
                this.page.title,
            );
        } else if (this.hasChoiceSections()) {
            options = await this.parseChoiceSections();
        }

        if (options.length === 0) {
            warn(`Couldn't find any options on page '${this.page.title}'`);

            return null;
        }

        return {
            type: CharacterPlannerStep.CLASS_FEATURE_SUBCHOICE,
            count: this.getChoiceCount(),
            options,
        };
    }

    async initOptionsAndEffects(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page) {
            return;
        }

        const isGrantableEffect = this.page.hasCategory([
            'Actions',
            'Bonus actions',
            'Reactions',
            'Free actions',
            'Movement-expending actions',
            'Class actions',
            'Passive features',
            'Toggleable passive features',
        ]);

        let effect: GrantableEffect | StaticallyReferenceable | null = null;
        let choice: ICharacterChoiceWithStubs | null = null;

        if (isGrantableEffect) {
            if (await this.isPassiveOption()) {
                choice = await this.parsePageForChoice();
            } else {
                effect = await CharacterFeature.parsePageForGrantableEffect(
                    this.page,
                );
            }
        } else if (this.page.hasCategory('Class features')) {
            choice = await this.parsePageForChoice();
        }

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

    async waitForInitialization(): Promise<any> {
        await Promise.all([
            super.waitForInitialization(),
            ...(this.choices?.map(async (choice) => {
                if (choice instanceof CharacterFeature) {
                    await choice.waitForInitialization();
                }
            }) ?? []),
        ]);
    }
}
