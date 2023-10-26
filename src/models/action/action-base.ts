import { DamageType } from 'planner-types/src/types/equipment-item';
import {
    ActionAreaCategory,
    ActionAreaOfEffectType,
    ActionAreaShape,
    ActionDamageSaveEffect,
    ActionRangeType,
    ActionRechargeFrequency,
    ActionResource,
    ActionSchool,
    IActionBase,
} from 'planner-types/src/types/action';
import { AbilityScore } from 'planner-types/src/types/ability';
import { PageNotFoundError } from '../errors';
import { error } from '../logger';
import { PageItem, PageLoadingState } from '../page-item';
import {
    MediaWikiTemplateParser,
    MediaWikiTemplateParserConfig,
} from '../mw-template-parser';

enum ActionLoadState {
    ACTION_BASE_DATA = 'ACTION_BASE_DATA',
}

export class ActionBase extends PageItem implements Partial<IActionBase> {
    name?: string;
    image?: string;
    level?: number;
    school?: ActionSchool;
    ritual?: boolean;
    summary?: string;
    description?: string;
    concentration?: boolean;
    attackRoll?: boolean;
    damage?: string;
    damageType?: DamageType;
    extraDamage?: string;
    extraDamageType?: DamageType;
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
    areaTurnStartDamageSaveEffect?: ActionDamageSaveEffect;
    areaTurnEndDamage?: string;
    notes?: string;
    recharge?: ActionRechargeFrequency;
    cost?: ActionResource;

    id?: number;

    constructor(pageTitle: string) {
        super({ pageTitle });

        this.initialized[ActionLoadState.ACTION_BASE_DATA] =
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

    protected async initData(): Promise<void> {
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
                parser: parseEnum(ActionSchool),
                default: ActionSchool.NONE,
            },
            ritual: { parser: boolean, default: false },
            summary: {
                parser: plainText,
                default: undefined,
            },
            description: {
                parser: plainText,
                default: undefined,
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
                parser: parseEnum(ActionDamageSaveEffect),
                default: undefined,
            },
            areaTurnEndDamage: {
                key: 'area turn end damage',
                parser: plainText,
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

    toJSON(): Partial<IActionBase> {
        const result: Partial<IActionBase> = {};

        const keys: Array<keyof IActionBase> = [
            'name',
            'damage',
            'damageType',
            'extraDamage',
            'extraDamageType',
            'image',
            'level',
            'school',
            'summary',
            'description',
            'ritual',
            'concentration',
            'id',
            'attackRoll',
            'range',
            'rangeM',
            'rangeFt',
            'aoe',
            'aoeM',
            'aoeFt',
            'condition',
            'conditionDuration',
            'conditionSave',
            'areaName',
            'areaCategory',
            'areaShape',
            'areaRangeM',
            'areaRangeFt',
            'areaDuration',
            'areaTurnStartDamage',
            'areaTurnStartDamageType',
            'areaTurnStartDamageSave',
            'areaTurnStartDamageSaveEffect',
            'areaTurnEndDamage',
            'notes',
            'recharge',
            'cost',
        ];

        keys.forEach((key) => {
            if (key in this) {
                result[key] = this[key] as any;
            }
        });

        return result;
    }
}
