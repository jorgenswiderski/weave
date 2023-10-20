import {
    GrantableEffect,
    GrantableEffectType,
} from 'planner-types/src/types/grantable-effect';
import {
    EquipmentItemProficiency,
    EquipmentItemType,
    IEquipmentItem,
    ItemRarity,
} from 'planner-types/src/types/equipment-item';
import { MwnApiClass } from '../../api/mwn';
import { PageNotFoundError } from '../errors';
import { error } from '../logger';
import { MediaWiki } from '../media-wiki';
import { PageItem, PageLoadingState } from '../page-item';
import {
    MediaWikiTemplateParser,
    MediaWikiTemplateParserConfig,
} from '../mw-template-parser';

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
    source?: string;
    notes?: string[];
    proficiency?: EquipmentItemProficiency;

    baseArmorClass?: number;
    bonusArmorClass?: number;
    enchantment?: number;

    constructor(public name: string) {
        super({ pageTitle: name });

        this.initialized[EquipmentItemLoadState.SPELL_DATA] =
            this.initData().catch(error);
    }

    private static parseEffects(effectText: string): GrantableEffect[] {
        const effectPattern = /\n\s*\*\s*'''(.*?):'''\s*(.*?)(?:\n|$)/g;

        return Array.from(effectText.matchAll(effectPattern)).map((match) => ({
            name: MediaWiki.stripMarkup(match[1]),
            description: MediaWiki.stripMarkup(match[2]),
            type: GrantableEffectType.CHARACTERISTIC,
        }));
    }

    private async initData(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        if (
            !this.page.content.includes('{{EquipmentPage') &&
            !this.page.content.includes('{{WeaponPage')
        ) {
            return;
        }

        const { image, plainText, int, float } =
            MediaWikiTemplateParser.Parsers;
        const { parseEnum } = MediaWikiTemplateParser.HighOrderParsers;

        const config: Record<string, MediaWikiTemplateParserConfig> = {
            image: { parser: image, default: undefined },
            icon: { parser: image, default: undefined },
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
            weightKg: { parser: float, default: undefined },
            weightLb: { parser: float, default: undefined },
            price: { parser: int, default: undefined },
            uid: { default: undefined },
            effects: { parser: EquipmentItem.parseEffects, default: [] },
            source: { parser: (value) => value.split('*'), default: undefined }, // FIXME
            notes: { parser: (value) => value.split('*'), default: undefined }, // FIXME
        };

        Object.assign(
            this,
            MediaWikiTemplateParser.parseTemplate(this.page, config),
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
            source: this.source,
            notes: this.notes,
            proficiency: this.proficiency,
            baseArmorClass: this.baseArmorClass,
            bonusArmorClass: this.bonusArmorClass,
            enchantment: this.enchantment,
        };
    }
}

let itemData: Record<string, EquipmentItem[]> | null = null;

export async function getEquipmentItemData(
    types?: EquipmentItemType[],
): Promise<Record<string, EquipmentItem[]>> {
    if (!itemData) {
        const categories = [
            'Equipment',
            'Clothing',
            'Light Armour',
            'Medium Armour',
            'Heavy Armour',
            'Shields',
            'Helmets',
            'Cloaks',
            'Handwear',
            'Footwear',
            'Amulets',
            'Rings',
        ];

        const equipmentItemNames = await Promise.all(
            categories.map((category) =>
                MwnApiClass.queryTitlesFromCategory(category),
            ),
        );
        const uniqueNames = [...new Set(equipmentItemNames.flat())];
        const data = uniqueNames.map((name) => new EquipmentItem(name));
        await Promise.all(data.map((item) => item.waitForInitialization()));

        itemData = data.reduce(
            (acc, item) => {
                if (item.type) {
                    if (!acc[item.type]) {
                        acc[item.type] = [];
                    }

                    acc[item.type].push(item);
                }

                return acc;
            },
            {} as Record<string, EquipmentItem[]>,
        );
    }

    if (!types) {
        return itemData;
    }

    const filteredData: Record<string, EquipmentItem[]> = {};

    types.forEach((type) => {
        if (itemData![type]) {
            filteredData[type] = itemData![type];
        }
    });

    return filteredData;
}
