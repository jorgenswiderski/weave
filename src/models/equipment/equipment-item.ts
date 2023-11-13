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
import assert from 'assert';
import {
    ItemSource,
    ItemSourceCharacter,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/item-sources';
import { PageNotFoundError } from '../errors';
import { debug, error } from '../logger';
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

let counter = 0;

type ItemSourcePageInfo = {
    title: string;
    info: { latestRevisionId: number; categories: string[] };
    data: PageData;
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

    protected static parseItemSourceCharacter(
        pages: ItemSourcePageInfo[],
        item: EquipmentItem,
    ): [ItemSourceCharacter | undefined, ItemSourcePageInfo[]] {
        const characterPages = pages.filter(
            (page) =>
                page.info.categories.includes('Category:Characters') ||
                page.info.categories.includes('Category:Creatures'),
        );

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
                    name: characterPages[0].title,
                    id: characterPages[0].data.pageId,
                },
                characterPages,
            ];
        }

        return [undefined, characterPages];
    }

    protected static parseGameLocation(
        pages: ItemSourcePageInfo[],
        item: EquipmentItem,
        characterPages: ItemSourcePageInfo[],
        character?: ItemSourceCharacter,
    ): GameLocation | undefined {
        const locationPages = pages.filter((page) =>
            gameLocationById.has(page.data.pageId),
        );

        if (locationPages.length > 0) {
            if (locationPages.length === 1) {
                return gameLocationById.get(locationPages[0].data.pageId);
            }

            if (locationPages.length > 1) {
                const locations = locationPages
                    .map((loc) => gameLocationById.get(loc.data.pageId))
                    .filter(Boolean) as GameLocation[];

                assert(locations.length > 0);

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

                        return match?.[1];
                    },
                },
            };

            const { location: locationPageTitle } =
                MediaWikiTemplateParser.parseTemplate(
                    characterPages[0].data,
                    config,
                );

            if (locationPageTitle) {
                return gameLocationByPageTitle.get(locationPageTitle);
            }
        }

        return undefined;
    }

    protected static async parseSource(
        source: string,
        item: EquipmentItem,
    ): Promise<ItemSource | undefined> {
        const pageTitleMatch = /\[\[([^#|\]]+).*?]]/g;
        const coordsTemplateMatch = /{{Coords\|-?\d+\|-?\d+\|([^}]+)}}/g;

        const matches = [
            ...source.matchAll(pageTitleMatch),
            ...source.matchAll(coordsTemplateMatch),
        ];

        const pageTitles = matches.map((match) => match[1]);

        const pages = (
            await Promise.all(
                pageTitles.map(async (title) => {
                    try {
                        return {
                            title,
                            info: await MediaWiki.getPageInfo(title),
                            data: (await MediaWiki.getPage(title))!,
                        };
                    } catch (err) {
                        return undefined;
                    }
                }),
            )
        ).filter(Boolean) as ItemSourcePageInfo[];

        const [character, characterPages] = this.parseItemSourceCharacter(
            pages,
            item,
        );

        const location: GameLocation | undefined = this.parseGameLocation(
            pages,
            item,
            characterPages,
            character,
        );

        if (location) {
            return {
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
