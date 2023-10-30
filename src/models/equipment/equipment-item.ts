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
import { PageNotFoundError } from '../errors';
import { error } from '../logger';
import { MediaWiki, PageData } from '../media-wiki';
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
    id?: number;

    baseArmorClass?: number;
    bonusArmorClass?: number;
    enchantment?: number;

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
        const namedEffectPattern = /\*\s*'''(.*?):'''\s*(.*?)(?:\n|$)/g;

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

    protected async initData(): Promise<void> {
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
            id: this.id,
        };
    }
}
