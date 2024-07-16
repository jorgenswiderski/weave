import {
    ActionAreaCategory,
    ActionAreaOfEffectType,
    ActionAreaShape,
    ActionDamageSaveEffect,
    ActionRangeType,
    ActionRechargeFrequency,
    ActionSchool,
    IActionBase,
    ActionCost,
    ActionCostBehavior,
    ActionResourceFromString,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/action';
import { AbilityScore } from '@jorgenswiderski/tomekeeper-shared/dist/types/ability';
import { DamageType } from '@jorgenswiderski/tomekeeper-shared/dist/types/damage';
import { PageNotFoundError } from '../errors';
import { error } from '../logger';
import { PageItem, PageLoadingState } from '../page-item';
import { MediaWikiTemplate } from '../media-wiki/media-wiki-template';
import { StaticImageCacheService } from '../static-image-cache-service';
import {
    IPageData,
    MediaWikiTemplateParserConfig,
    MediaWikiTemplateParserConfigItem,
} from '../media-wiki/types';

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
    areaTurnEndDamageType?: DamageType;
    areaTurnEndDamageSave?: AbilityScore;
    areaTurnEndDamageSaveEffect?: ActionDamageSaveEffect;
    // notes?: string;
    recharge?: ActionRechargeFrequency;
    costs?: ActionCost[];

    id?: number;

    used: boolean = false;

    constructor(
        pageTitle: string,
        public templateName: string,
    ) {
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

    protected parseCosts(template: MediaWikiTemplate): void {
        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        const actionCostParser = (
            value: string,
            config: MediaWikiTemplateParserConfigItem,
            page?: IPageData,
        ) => {
            const costMatches = [...value.matchAll(/([\w\s]+)(?::(\d+))?/g)];

            const costs = costMatches.map(
                ([, resource, amount]): ActionCost => {
                    // eslint-disable-next-line no-param-reassign
                    resource = resource.trim().toLowerCase();

                    if (
                        !(resource in ActionResourceFromString) &&
                        resource !== ''
                    ) {
                        error(
                            `Failed to map resource '${resource}' to enum (${page?.title}) in key '${config.key}' .`,
                        );
                    }

                    return {
                        resource: ActionResourceFromString[resource],
                        amount: parseInt(amount ?? 1, 10),
                        behavior:
                            config.key === 'hit cost'
                                ? ActionCostBehavior.onHit
                                : undefined,
                    };
                },
            );

            return costs;
        };

        const config: MediaWikiTemplateParserConfig = {
            cost: {
                parser: actionCostParser,
                default: [],
            },
            hitCost: {
                key: 'hit cost',
                parser: actionCostParser,
                default: [],
            },
        };

        const { cost, hitCost } = template.parse(config);

        this.costs = [...cost, ...hitCost];
    }

    protected async initData(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        this.id = this.page.pageId;

        const { plainText, boolean, int } = MediaWikiTemplate.Parsers;

        const { parseEnum } = MediaWikiTemplate.HighOrderParsers;

        const config: MediaWikiTemplateParserConfig = {
            name: { parser: plainText, default: this.pageTitle },
            image: {
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
            areaTurnEndDamageType: {
                key: 'area turn end damage type',
                parser: parseEnum(DamageType),
                default: undefined,
            },
            areaTurnEndDamageSave: {
                key: 'area turn end damage save',
                parser: parseEnum(AbilityScore),
                default: undefined,
            },
            areaTurnEndDamageSaveEffect: {
                key: 'area turn end damage save effect',
                parser: parseEnum(ActionDamageSaveEffect),
                default: undefined,
            },
            // notes: {
            //     parser: plainText,
            //     default: undefined,
            // },
            recharge: {
                parser: parseEnum(ActionRechargeFrequency),
                default: undefined,
            },
        };

        const template = await this.page.getTemplate(this.templateName);
        Object.assign(this, template.parse(config));
        this.parseCosts(template);
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
            'areaTurnEndDamageType',
            'areaTurnEndDamageSave',
            'areaTurnEndDamageSaveEffect',
            // 'notes',
            'recharge',
            'costs',
        ];

        keys.forEach((key) => {
            if (key in this) {
                result[key] = this[key] as any;
            }
        });

        return result;
    }

    markUsed(): void {
        if (this.image) {
            StaticImageCacheService.cacheImage(this.image);
        }

        this.used = true;
    }
}
