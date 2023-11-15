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
import { debug, error, warn } from '../logger';
import { MediaWiki, PageData } from '../media-wiki';
import { PageItem, PageLoadingState } from '../page-item';
import {
    MediaWikiTemplateParser,
    MediaWikiTemplateParserConfig,
} from '../mw-template-parser';
import {
    GameLocation,
    gameLocationById,
    gameLocationByPageTitle,
} from '../locations/locations';
import { CharacterFeature } from '../character-feature/character-feature';

let counter = 0;

type ItemSourcePageInfo = {
    title: string;
    info?: { latestRevisionId: number; categories: string[] };
    data?: PageData;
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

    constructor(public name: string) {
        super({ pageTitle: name });

        this.initialized[EquipmentItemLoadState.SPELL_DATA] =
            this.initData().catch(error);
    }

    private static parseEffects(
        effectText: string,
        config: MediaWikiTemplateParserConfig,
        page: PageData,
    ): GrantableEffect[] {
        const namedEffectPattern = /\*\s*'''(.*?):?''':?\s*(.*?)(?:\n|$)/g;

        const effects: GrantableEffect[] = Array.from(
            effectText.matchAll(namedEffectPattern),
        ).map((match) => ({
            name: MediaWiki.stripMarkup(match[1]).trim(),
            description: MediaWiki.stripMarkup(match[2]).trim(),
            type: GrantableEffectType.CHARACTERISTIC,
        }));

        const anonEffectPattern = /\*\s+([^'].+)/g;

        const anonEffects = Array.from(
            effectText.matchAll(anonEffectPattern),
        ).map((match) => ({
            name: 'Anonymous Effect',
            description: MediaWiki.stripMarkup(match[1]).trim(),
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

    protected static parseItemSourceQuest(
        pages: ItemSourcePageInfo[],
        item: EquipmentItem,
    ): [ItemSourceQuest | undefined, Required<ItemSourcePageInfo[]>] {
        const questPages = pages.filter(
            (page) => page.info?.categories.includes('Category:Quests'),
        ) as Required<ItemSourcePageInfo>[];

        if (questPages.length > 1) {
            warn(
                `Item '${item.name}' has a source that mentions multiple quests`,
            );
        }

        if (questPages.length > 0) {
            return [
                {
                    name: CharacterFeature.parseNameFromPageTitle(
                        questPages[0].title,
                    ),
                    id: questPages[0].data.pageId,
                },
                questPages,
            ];
        }

        return [undefined, questPages];
    }

    protected static parseItemSourceCharacter(
        pages: ItemSourcePageInfo[],
        item: EquipmentItem,
    ): [ItemSourceCharacter | undefined, Required<ItemSourcePageInfo[]>] {
        const characterPages = pages.filter(
            (page) =>
                (page.info?.categories.includes('Category:Characters') ||
                    page.info?.categories.includes('Category:Creatures')) &&
                !page.info?.categories.includes('Category:Origins'),
        ) as Required<ItemSourcePageInfo>[];

        // if (characterPages.length > 1) {
        //     warn(
        //         `Item '${item.name}' has a source that mentions multiple characters, coercing to first character`,
        //     );
        // }

        if (characterPages.length > 0) {
            if (!characterPages[0].data.content?.includes('{{CharacterInfo')) {
                error(
                    `Item '${item.name}' source page '${characterPages[0].title}' has no CharacterInfo template!`,
                );
            }

            return [
                {
                    name: CharacterFeature.parseNameFromPageTitle(
                        characterPages[0].title,
                    ),
                    id: characterPages[0].data.pageId,
                },
                characterPages,
            ];
        }

        return [undefined, characterPages];
    }

    protected static async parseGameLocation(
        pages: ItemSourcePageInfo[],
        item: EquipmentItem,
        characterPages: Required<ItemSourcePageInfo>[],
        questPages: Required<ItemSourcePageInfo>[],
        character?: ItemSourceCharacter,
        quest?: ItemSourceQuest,
    ): Promise<GameLocation | undefined> {
        const locationPages = pages.filter(({ data, title }) =>
            data?.pageId
                ? gameLocationById.has(data.pageId)
                : gameLocationByPageTitle.has(title),
        );

        const locations = locationPages.map(({ data, title }) =>
            data?.pageId
                ? gameLocationById.get(data.pageId)!
                : gameLocationByPageTitle.get(title)!,
        );

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
            const config: Record<string, MediaWikiTemplateParserConfig> = {
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

            const { location: locationPageTitle } =
                MediaWikiTemplateParser.parseTemplate(
                    characterPages[0].data,
                    config,
                );

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
                const pageTitles = this.getAllPageTitles(preamble);
                const newPages = await this.getPageInfoFromTitles(pageTitles);

                return this.parseGameLocation(newPages, item, [], []);
            }
        }

        return undefined;
    }

    protected static getAllPageTitles(content: string): string[] {
        const pageTitleMatch = /\[\[([^#|\]]+).*?]]/g;
        const coordsTemplateMatch = /{{Coords\|-?\d+\|-?\d+\|([^}]+)}}/g;

        return [
            ...content.matchAll(pageTitleMatch),
            ...content.matchAll(coordsTemplateMatch),
        ].map((match) => match[1]);
    }

    protected static async getPageInfoFromTitles(
        pageTitles: string[],
    ): Promise<ItemSourcePageInfo[]> {
        return (
            await Promise.all(
                pageTitles.map(async (title) => {
                    try {
                        const page = (await MediaWiki.getPage(title))!;

                        return {
                            title: page.title,
                            info: await MediaWiki.getPageInfo(title),
                            data: page,
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

    protected static async parseSource(
        source: string,
        item: EquipmentItem,
    ): Promise<ItemSource | undefined> {
        const pageTitles = this.getAllPageTitles(source);
        const pages = await this.getPageInfoFromTitles(pageTitles);

        const [quest, questPages] = source.toLowerCase().includes('reward')
            ? this.parseItemSourceQuest(pages, item)
            : [undefined, []];

        const [character, characterPages] = this.parseItemSourceCharacter(
            pages,
            item,
        );

        const location = await this.parseGameLocation(
            pages,
            item,
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

        if (
            !this.page.content.includes('{{EquipmentPage') &&
            !this.page.content.includes('{{WeaponPage')
        ) {
            return;
        }

        this.id = this.page.pageId;

        const { noOp, plainText, int, float } = MediaWikiTemplateParser.Parsers;
        const { parseEnum } = MediaWikiTemplateParser.HighOrderParsers;

        const config: Record<string, MediaWikiTemplateParserConfig> = {
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

        const { sources, ...rest } = MediaWikiTemplateParser.parseTemplate(
            this.page,
            config,
        );

        if (sources) {
            this.sources = (
                await Promise.all(
                    sources.map((source: string) =>
                        EquipmentItem.parseSource(source, this),
                    ),
                )
            ).filter(Boolean) as ItemSource[];

            if (
                this.sources.length === 0 &&
                !this.name.match(/\+\d$/) &&
                rest.rarity > ItemRarity.common
            ) {
                counter += 1;
                debug(counter, this.name);
            }
        }

        Object.assign(this, rest);
    }

    async isObtainable(): Promise<boolean> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        return (
            !this.page.content.includes('{{Legacy Content}}') &&
            !this.page.content.includes('{{Unobtainable}}') &&
            !this.page.content.includes('{{Inaccessible}}')
        );
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
