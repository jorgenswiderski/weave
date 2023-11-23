import {
    GrantableEffect,
    GrantableEffectType,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import {
    EquipmentItemProficiency,
    EquipmentItemType,
    IEquipmentItem,
    ItemRarity,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/equipment-item';
import {
    ItemSource,
    ItemSourceCharacter,
    ItemSourceQuest,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/item-sources';
import { PageNotFoundError } from '../errors';
import { error, warn } from '../logger';
import { MediaWiki } from '../media-wiki/media-wiki';
import { PageItem, PageLoadingState } from '../page-item';
import { MediaWikiTemplate } from '../media-wiki/media-wiki-template';
import {
    GameLocation,
    gameLocationById,
    gameLocationByPageTitle,
} from '../locations/locations';
import { MediaWikiParser } from '../media-wiki/media-wiki-parser';
import {
    MediaWikiTemplateParserConfigItem,
    MediaWikiTemplateParserConfig,
    IPageData,
} from '../media-wiki/types';

type ItemSourcePageInfo = {
    title: string;
    info?: {
        latestRevisionId: number;
        categories: string[];
        redirect?: string;
    };
    data?: IPageData;
};

enum EquipmentItemLoadState {
    SPELL_DATA = 'SPELL_DATA',
}

export class EquipmentItem extends PageItem implements Partial<IEquipmentItem> {
    image?: string;
    icon?: string;
    description?: string;
    quote?: string;
    type?: EquipmentItemType;
    rarity?: ItemRarity;
    weightKg?: number;
    weightLb?: number;
    price?: number;
    uid?: string;
    effects?: GrantableEffect[];
    sources?: ItemSource[];
    // notes?: string[];
    proficiency?: EquipmentItemProficiency;
    id?: number;

    baseArmorClass?: number;
    bonusArmorClass?: number;
    enchantment?: number;

    obtainable?: boolean;

    constructor(
        public name: string,
        public templateName: string = 'EquipmentPage',
    ) {
        super({ pageTitle: name });

        this.initialized[EquipmentItemLoadState.SPELL_DATA] =
            this.initData().catch(error);
    }

    private static parseEffects(
        effectText: string,
        config: MediaWikiTemplateParserConfigItem,
        page: IPageData,
    ): GrantableEffect[] {
        const namedEffectPattern = /\*\s*'''(.*?):?''':?\s*(.*?)(?:\n|$)/g;

        const effects: GrantableEffect[] = Array.from(
            effectText.matchAll(namedEffectPattern),
        ).map((match) => ({
            name: MediaWikiParser.stripMarkup(match[1]).trim(),
            description: MediaWikiParser.stripMarkup(match[2]).trim(),
            type: GrantableEffectType.CHARACTERISTIC,
        }));

        const anonEffectPattern = /\*\s+([^'].+)/g;

        const anonEffects = Array.from(
            effectText.matchAll(anonEffectPattern),
        ).map((match) => ({
            name: 'Anonymous Effect',
            description: MediaWikiParser.stripMarkup(match[1]).trim(),
            type: GrantableEffectType.CHARACTERISTIC,
            hidden: true,
        }));

        effects.push(...anonEffects);

        if (anonEffects.length > 0) {
            effects.push({
                name: page.title,
                description: anonEffects
                    .map((effect) => effect.description)
                    .join('\n'),
                type: GrantableEffectType.CHARACTERISTIC,
            });
        }

        return effects;
    }

    protected parseItemSourceQuest(
        pages: ItemSourcePageInfo[],
    ): [ItemSourceQuest | undefined, Required<ItemSourcePageInfo[]>] {
        const questPages = pages.filter(
            (page) => page.data?.hasCategory('Quests'),
        ) as Required<ItemSourcePageInfo>[];

        if (questPages.length > 1) {
            warn(
                `Item '${this.name}' has a source that mentions multiple quests`,
            );
        }

        if (questPages.length > 0) {
            return [
                {
                    name: MediaWikiParser.parseNameFromPageTitle(
                        questPages[0].title,
                    ),
                    id: questPages[0].data.pageId,
                },
                questPages,
            ];
        }

        return [undefined, questPages];
    }

    protected async parseItemSourceCharacter(
        pages: ItemSourcePageInfo[],
    ): Promise<
        [ItemSourceCharacter | undefined, Required<ItemSourcePageInfo[]>]
    > {
        const characterPages = pages.filter(
            (page) =>
                page.data?.hasCategory(['Characters', 'Creatures']) &&
                !page.data?.hasCategory('Origins'),
        ) as Required<ItemSourcePageInfo>[];

        // if (characterPages.length > 1) {
        //     warn(
        //         `Item '${item.name}' has a source that mentions multiple characters, coercing to first character`,
        //     );
        // }

        if (characterPages.length > 0) {
            if (!(await characterPages[0].data.hasTemplate('CharacterInfo'))) {
                error(
                    `Item '${this.name}' source page '${characterPages[0].title}' has no CharacterInfo template!`,
                );
            }

            return [
                {
                    name: MediaWikiParser.parseNameFromPageTitle(
                        characterPages[0].title,
                    ),
                    id: characterPages[0].data.pageId,
                },
                characterPages,
            ];
        }

        return [undefined, characterPages];
    }

    protected async parseGameLocation(
        pages: ItemSourcePageInfo[],
        characterPages: Required<ItemSourcePageInfo>[],
        questPages: Required<ItemSourcePageInfo>[],
        character?: ItemSourceCharacter,
        quest?: ItemSourceQuest,
    ): Promise<GameLocation | undefined> {
        const locationPages = pages.filter(({ data, title }) => {
            return data?.pageId
                ? gameLocationById.has(data.pageId)
                : gameLocationByPageTitle.has(title);
        });

        const locations = locationPages.map(({ data, title }) => {
            return data?.pageId
                ? gameLocationById.get(data.pageId)!
                : gameLocationByPageTitle.get(title)!;
        });

        if (locations.length > 0) {
            if (locations.length === 1) {
                return locations[0];
            }

            if (locations.length > 1) {
                // Find the location with the highest depth value (most specific location)
                locations.sort((a, b) => b.depth - a.depth);

                // if (
                //     locations.length > 1 &&
                //     locations[0].depth === locations[1].depth
                // ) {
                //     warn(
                //         `Item '${item.name}' has a source that mentions multiple locations with the same depth`,
                //     );
                // }

                return locations[0];
            }
        } else if (character) {
            const config: MediaWikiTemplateParserConfig = {
                location: {
                    parser: (value) => {
                        const match = value.match(/\[\[([^#|\]]+).*?]]/);

                        if (match?.[1]) {
                            return match[1];
                        }

                        const coordsTemplateMatch = value.match(
                            /{{Coords\|-?\d+\|-?\d+\|([^}]+)}}/,
                        );

                        return coordsTemplateMatch?.[1];
                    },
                },
            };

            const template =
                await characterPages[0].data.getTemplate('CharacterInfo');

            const { location: locationPageTitle } = template.parse(config);

            if (locationPageTitle) {
                try {
                    // Get the real page title, in case of redirects
                    const page = await MediaWiki.getPage(locationPageTitle);

                    if (page) {
                        return gameLocationByPageTitle.get(page.title);
                    }
                } catch (err) {
                    error(err);
                }
            }
        } else if (quest) {
            const match = questPages[0].data.content?.match(/([\s\S]+?)\n==/);

            if (match) {
                const preamble = match[1];

                const pageTitles = MediaWikiParser.getAllPageTitles(preamble);

                const newPages =
                    await EquipmentItem.getPageInfoFromTitles(pageTitles);

                return this.parseGameLocation(newPages, [], []);
            }
        }

        return undefined;
    }

    protected static async getPageInfoFromTitles(
        pageTitles: string[],
    ): Promise<ItemSourcePageInfo[]> {
        return (
            await Promise.all(
                pageTitles.map(async (title) => {
                    try {
                        const data = await MediaWiki.getPage(title);

                        return {
                            title: data.title,
                            data,
                        };
                    } catch (err) {
                        if (gameLocationByPageTitle.has(title)) {
                            return { title };
                        }

                        return undefined;
                    }
                }),
            )
        ).filter(Boolean) as ItemSourcePageInfo[];
    }

    protected async parseSource(
        source: string,
    ): Promise<ItemSource | undefined> {
        const pageTitles = MediaWikiParser.getAllPageTitles(source);
        const pages = await EquipmentItem.getPageInfoFromTitles(pageTitles);

        const [quest, questPages] = source.toLowerCase().includes('reward')
            ? this.parseItemSourceQuest(pages)
            : [undefined, []];

        const [character, characterPages] =
            await this.parseItemSourceCharacter(pages);

        const location = await this.parseGameLocation(
            pages,
            characterPages as Required<ItemSourcePageInfo>[],
            questPages as Required<ItemSourcePageInfo>[],
            character,
            quest,
        );

        if (location) {
            return {
                quest,
                location: location.getItemSourceLocation(),
                character,
            };
        }

        return undefined;
    }

    protected async initData(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        this.obtainable = await this.isObtainable();

        if (!this.obtainable) {
            return;
        }

        if (!(await this.page.hasTemplate(['WeaponPage', 'EquipmentPage']))) {
            return;
        }

        this.id = this.page.pageId;

        const { noOp, plainText, int, float } = MediaWikiTemplate.Parsers;
        const { parseEnum } = MediaWikiTemplate.HighOrderParsers;

        const config: MediaWikiTemplateParserConfig = {
            image: { parser: noOp, default: undefined },
            icon: { parser: noOp, default: undefined },
            description: { parser: plainText, default: undefined },
            quote: { parser: plainText, default: undefined },
            type: {
                parser: parseEnum(EquipmentItemType),
            },
            proficiency: {
                parser: parseEnum(EquipmentItemProficiency),
                default: EquipmentItemProficiency.NONE,
            },
            baseArmorClass: {
                key: 'armour class',
                parser: int,
                default: undefined,
            },
            bonusArmorClass: {
                key: 'armour class bonus',
                parser: int,
                default: undefined,
            },
            enchantment: { parser: int, default: undefined },
            rarity: { parser: parseEnum(ItemRarity), default: ItemRarity.NONE },
            weightKg: { key: 'weight kg', parser: float, default: undefined },
            weightLb: { key: 'weight lb', parser: float, default: undefined },
            price: { parser: int, default: undefined },
            uid: { default: undefined },
            effects: {
                key: 'special',
                parser: EquipmentItem.parseEffects,
                default: [],
            },

            // Passed to initSources, not assigned to this
            sources: {
                key: 'where to find',
                parser: (value) =>
                    value
                        .split('*')
                        .map((str) => str.trim())
                        .filter((str) => str.length > 0),
                default: undefined,
            },
            // notes: { parser: (value) => value.split('*'), default: undefined }, // FIXME
        };

        const template = await this.page.getTemplate(this.templateName);
        const { sources, ...rest } = template.parse(config);

        if (sources) {
            this.sources = (
                await Promise.all(
                    sources.map((source: string) => this.parseSource(source)),
                )
            ).filter(Boolean) as ItemSource[];

            if (
                this.sources.length === 0 &&
                !this.name.match(/\+\d$/) &&
                rest.rarity > ItemRarity.common
            ) {
                warn(`Failed to parse sources for item '${this.name}'`);
            }
        }

        Object.assign(this, rest);
    }

    async isObtainable(): Promise<boolean> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        return !(await this.page.hasTemplate([
            'Legacy Content',
            'Unobtainable',
            'Inaccessible',
        ]));
    }

    toJSON() {
        return {
            name: this.name,
            image: this.image,
            icon: this.icon,
            description: this.description,
            quote: this.quote,
            type: this.type,
            rarity: this.rarity,
            weightKg: this.weightKg,
            weightLb: this.weightLb,
            price: this.price,
            uid: this.uid,
            effects: this.effects,
            sources: this.sources,
            // notes: this.notes,
            proficiency: this.proficiency,
            baseArmorClass: this.baseArmorClass,
            bonusArmorClass: this.bonusArmorClass,
            enchantment: this.enchantment,
            id: this.id,
        };
    }
}
