import {
    ISpell,
    SpellDamageSaveEffect,
    SpellSchool,
} from 'planner-types/src/types/spell';
import { DamageType } from 'planner-types/src/types/equipment-item';
import {
    ActionAreaCategory,
    ActionAreaOfEffectType,
    ActionAreaShape,
    ActionRangeType,
    ActionRechargeFrequency,
    ActionType,
} from 'planner-types/src/types/action';
import { AbilityScore } from 'planner-types/src/types/ability';
import { MwnApiClass } from '../../api/mwn';
import { PageNotFoundError } from '../errors';
import { error } from '../logger';
import { PageItem, PageLoadingState } from '../page-item';
import {
    MediaWikiTemplateParser,
    MediaWikiTemplateParserConfig,
} from '../mw-template-parser';

enum SpellLoadState {
    SPELL_DATA = 'SPELL_DATA',
}

let spellData: Spell[];
let spellDataById: Map<number, Spell> | null = null;

export class Spell extends PageItem implements Partial<ISpell> {
    name?: string;
    image?: string;
    level?: number;
    school?: SpellSchool;
    ritual?: boolean;
    classes?: string[];
    summary?: string;
    description?: string;
    actionType?: ActionType;
    concentration?: boolean;
    noSpellSlot?: boolean;

    attackRoll?: boolean;
    damage?: string;
    damageType?: DamageType;
    extraDamage?: string;
    extraDamageType?: DamageType;
    damageSave?: AbilityScore;
    damageSaveEffect?: SpellDamageSaveEffect;
    damagePer?: string;
    range?: ActionRangeType;
    rangeM?: number;
    rangeFt?: number;
    aoe?: ActionAreaOfEffectType;
    aoeM?: number;
    aoeFt?: number;
    condition?: string;
    conditionDuration?: number;
    conditionSave?: AbilityScore;
    areaName?: string;
    areaCategory?: ActionAreaCategory;
    areaShape?: ActionAreaShape;
    areaRangeM?: number;
    areaRangeFt?: number;
    areaDuration?: number;
    areaTurnStartDamage?: string;
    areaTurnStartDamageType?: DamageType;
    areaTurnStartDamageSave?: AbilityScore;
    areaTurnStartDamageSaveEffect?: SpellDamageSaveEffect;
    areaTurnEndDamage?: string;
    higherLevels?: string;
    variants?: string[];
    notes?: string;
    recharge?: ActionRechargeFrequency;

    id?: number;

    constructor(pageTitle: string) {
        super({ pageTitle });

        this.initialized[SpellLoadState.SPELL_DATA] =
            this.initData().catch(error);
    }

    static parseValueFromSpellPageTemplate(
        wikitext: string,
        key: string,
    ): string | undefined {
        const regex = new RegExp(`\\|\\s*${key}\\s*=(.*?)\\n\\|`, 'i');
        const match = wikitext.match(regex);

        return match ? match[1].trim() : undefined;
    }

    private async initData(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        this.id = this.page.pageId;

        const { noOp, plainText, boolean, int } =
            MediaWikiTemplateParser.Parsers;
        const { parseEnum } = MediaWikiTemplateParser.HighOrderParsers;

        const config: Record<string, MediaWikiTemplateParserConfig> = {
            name: { parser: plainText, default: this.pageTitle },
            image: {
                parser: noOp,
                default: undefined,
            },
            level: {
                parser: (value) =>
                    value === 'cantrip' ? 0 : parseInt(value || '0', 10),
                default: 0,
            },
            school: {
                parser: parseEnum(SpellSchool),
                default: SpellSchool.NONE,
            },
            ritual: { parser: boolean, default: false },
            classes: {
                parser: (value) =>
                    value
                        ?.split(',')
                        .map((c) => c.trim())
                        .filter((c) => c !== '') || [],
                default: [],
            },
            summary: {
                parser: plainText,
                default: undefined,
            },
            description: {
                parser: plainText,
                default: undefined,
            },
            actionType: {
                key: 'action type',
                parser: parseEnum(ActionType),
                default: ActionType.NONE,
            },
            attackRoll: { key: 'attack roll', parser: boolean, default: false },
            damage: { parser: plainText, default: undefined },
            damageType: {
                key: 'damage type',
                parser: parseEnum(DamageType),
                default: undefined,
            },
            extraDamage: {
                key: 'extra damage',
                parser: plainText,
                default: undefined,
            },
            extraDamageType: {
                key: 'extra damage type',
                parser: parseEnum(DamageType),
                default: undefined,
            },
            concentration: { parser: boolean, default: false },
            noSpellSlot: {
                key: 'no spell slot',
                parser: boolean,
                default: false,
            },
            damageSave: {
                key: 'damage save',
                parser: parseEnum(AbilityScore),
                default: undefined,
            },
            damageSaveEffect: {
                key: 'damage save effect',
                parser: parseEnum(SpellDamageSaveEffect),
                default: SpellDamageSaveEffect.negate,
            },
            damagePer: {
                key: 'damage per',
                parser: plainText,
                default: undefined,
            },
            range: {
                parser: parseEnum(ActionRangeType),
                default: undefined,
            },
            rangeM: {
                key: 'range m',
                parser: int,
                default: undefined,
            },
            rangeFt: {
                key: 'range ft',
                parser: int,
                default: undefined,
            },
            aoe: {
                parser: parseEnum(ActionAreaOfEffectType),
                default: undefined,
            },
            aoeM: {
                key: 'aoe m',
                parser: int,
                default: undefined,
            },
            aoeFt: {
                key: 'aoe ft',
                parser: int,
                default: undefined,
            },
            condition: {
                parser: plainText,
                default: undefined,
            },
            conditionDuration: {
                key: 'condition duration',
                parser: int,
                default: undefined,
            },
            conditionSave: {
                key: 'condition save',
                parser: parseEnum(AbilityScore),
                default: undefined,
            },
            areaName: {
                key: 'area',
                parser: plainText,
                default: undefined,
            },
            areaCategory: {
                key: 'area category',
                parser: parseEnum(ActionAreaCategory),
                default: undefined,
            },
            areaShape: {
                key: 'area shape',
                parser: parseEnum(ActionAreaShape),
                default: undefined,
            },
            areaRangeM: {
                key: 'area range m',
                parser: int,
                default: undefined,
            },
            areaRangeFt: {
                key: 'area range ft',
                parser: int,
                default: undefined,
            },
            areaDuration: {
                key: 'area duration',
                parser: int,
                default: undefined,
            },
            areaTurnStartDamage: {
                key: 'area turn start damage',
                parser: plainText,
                default: undefined,
            },
            areaTurnStartDamageType: {
                key: 'area turn start damage type',
                parser: parseEnum(DamageType),
                default: undefined,
            },
            areaTurnStartDamageSave: {
                key: 'area turn start damage save',
                parser: parseEnum(AbilityScore),
                default: undefined,
            },
            areaTurnStartDamageSaveEffect: {
                key: 'area turn start damage save effect',
                parser: parseEnum(SpellDamageSaveEffect),
                default: SpellDamageSaveEffect.negate,
            },
            areaTurnEndDamage: {
                key: 'area turn end damage',
                parser: plainText,
                default: undefined,
            },
            higherLevels: {
                // FIXME: type is "content"
                key: 'higher levels',
                parser: plainText,
                default: undefined,
            },
            variants: {
                // FIXME
                parser: (value) => {
                    const variants = value
                        ?.split(',')
                        .map((v) => v.trim())
                        .filter((v) => v.length);

                    return variants.length > 0 ? variants : undefined;
                },
                default: undefined,
            },
            notes: {
                parser: plainText,
                default: undefined,
            },
            recharge: {
                parser: parseEnum(ActionRechargeFrequency),
                default: undefined,
            },
        };

        Object.assign(
            this,
            MediaWikiTemplateParser.parseTemplate(this.page, config),
        );
    }

    // hardcoded variants that are tricky to catch with general logic
    static VARIANT_SPELLS = [
        'Enlarge',
        'Reduce',

        // Enhance Ability
        "Bear's Endurance",
        "Bull's Strength",
        "Cat's Grace",
        "Eagle's Splendour",
        "Fox's Cunning",
        "Owl's Wisdom",
    ];

    // Remove spell variants eg "Disguise Self: Femme Human" or "Chromatic Orb: Fire"
    isVariant(): boolean {
        if (!this.name) {
            return false;
        }

        if (Spell.VARIANT_SPELLS.includes(this.name)) {
            return true;
        }

        let shortName: string;

        if (this.name.startsWith('Reapply ')) {
            shortName = this.name.split('Reapply ')[1]!;
        } else {
            shortName = /^[^:(]+/.exec(this.name)![0].trim();
        }

        return (
            spellData.findIndex(
                (spell) => this !== spell && spell.name === shortName,
            ) >= 0
        );
    }

    toJSON() {
        return {
            name: this.name,
            image: this.image,
            level: this.level,
            school: this.school,
            ritual: this.ritual,
            classes: this.classes,
            summary: this.summary,
            description: this.description,
            actionType: this.actionType,
            concentration: this.concentration,
            noSpellSlot: this.noSpellSlot,
            id: this.id,

            attackRoll: this.attackRoll,
            damage: this.damage,
            damageType: this.damageType,
            extraDamage: this.extraDamage,
            extraDamageType: this.extraDamageType,
            damageSave: this.damageSave,
            damageSaveEffect: this.damageSaveEffect,
            damagePer: this.damagePer,
            range: this.range,
            rangeM: this.rangeM,
            rangeFt: this.rangeFt,
            aoe: this.aoe,
            aoeM: this.aoeM,
            aoeFt: this.aoeFt,
            condition: this.condition,
            conditionDuration: this.conditionDuration,
            conditionSave: this.conditionSave,
            areaName: this.areaName,
            areaCategory: this.areaCategory,
            areaShape: this.areaShape,
            areaRangeM: this.areaRangeM,
            areaRangeFt: this.areaRangeFt,
            areaDuration: this.areaDuration,
            areaTurnStartDamage: this.areaTurnStartDamage,
            areaTurnStartDamageType: this.areaTurnStartDamageType,
            areaTurnStartDamageSave: this.areaTurnStartDamageSave,
            areaTurnStartDamageSaveEffect: this.areaTurnStartDamageSaveEffect,
            areaTurnEndDamage: this.areaTurnEndDamage,
            higherLevels: this.higherLevels,
            variants: this.variants,
            notes: this.notes,
            recharge: this.recharge,
        };
    }
}

export async function getSpellData(): Promise<Spell[]> {
    if (!spellData) {
        const classNames = await MwnApiClass.queryTitlesFromCategory('Spells');

        spellData = classNames.map((name) => new Spell(name));
        await Promise.all(spellData.map((cc) => cc.waitForInitialization()));
        spellData = spellData.filter((spell) => !spell.isVariant());

        spellDataById = new Map<number, Spell>();
        spellData.forEach((spell) => spellDataById!.set(spell.id!, spell));
    }

    return spellData;
}

export async function getSpellDataById() {
    if (!spellDataById) {
        await getSpellData();
    }

    return spellDataById!;
}
