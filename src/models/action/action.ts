import {
    ActionCostBehavior,
    ActionResourceFromString,
    IAction,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/action';
import { AbilityScore } from '@jorgenswiderski/tomekeeper-shared/dist/types/ability';
import { PageNotFoundError } from '../errors';
import { MediaWikiTemplate } from '../media-wiki/media-wiki-template';
import { ActionBase } from './action-base';
import { error } from '../logger';
import {
    MediaWikiTemplateParserConfigItem,
    MediaWikiTemplateParserConfig,
    IPageData,
} from '../media-wiki/types';

export class Action extends ActionBase implements Partial<IAction> {
    condition2?: string;
    condition2Duration?: number;
    condition2Save?: AbilityScore;

    constructor(pageTitle: string, template: string = 'ActionPage') {
        super(pageTitle, template);
    }

    // TODO: Move this to action-base once the SpellPage template is done being revised
    // https://discord.com/channels/937803826583445565/1173680631125909514
    protected async parseCosts(): Promise<void> {
        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        const actionResourceParser = (
            value: string,
            config: MediaWikiTemplateParserConfigItem,
            page: IPageData,
        ) => {
            if (!(value in ActionResourceFromString) && value !== '') {
                error(
                    `Failed to map '${config.key}' value '${value}' to enum (${page.title}).`,
                );
            }

            return ActionResourceFromString[value];
        };

        const { int } = MediaWikiTemplate.Parsers;

        const config: MediaWikiTemplateParserConfig = {
            cost: {
                parser: actionResourceParser,
                default: undefined,
            },
            costAmount: {
                key: 'cost amount',
                parser: int,
                default: undefined,
            },
            cost2: {
                parser: actionResourceParser,
                default: undefined,
            },
            cost2Amount: {
                key: 'cost2 amount',
                parser: int,
                default: undefined,
            },
            cost3: {
                parser: actionResourceParser,
                default: undefined,
            },
            cost3Amount: {
                key: 'cost3 amount',
                parser: int,
                default: undefined,
            },
            hitCost: {
                key: 'hit cost',
                parser: actionResourceParser,
                default: undefined,
            },
            hitCostAmount: {
                key: 'hit cost amount',
                parser: int,
                default: undefined,
            },
            hitCost2: {
                key: 'hit cost2',
                parser: actionResourceParser,
                default: undefined,
            },
            hitCost2Amount: {
                key: 'hit cost2 amount',
                parser: int,
                default: undefined,
            },
        };

        const template = await this.page.getTemplate(this.templateName);
        const props = template.parse(config);

        const resources = Object.fromEntries(
            Object.entries(props).filter(
                ([key, value]) => value && !key.endsWith('Amount'),
            ),
        );

        this.costs = Object.entries(resources).map(([key, resource]) => {
            const amountKey = `${key}Amount`;
            const amount = props[amountKey];
            const isHitCost = key.startsWith('hit');

            return {
                resource,
                amount: amount ?? 1,
                behavior: isHitCost ? ActionCostBehavior.onHit : undefined,
            };
        });
    }

    protected async initData(): Promise<void> {
        await super.initData();

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        const { plainText, int } = MediaWikiTemplate.Parsers;
        const { parseEnum } = MediaWikiTemplate.HighOrderParsers;

        const config: MediaWikiTemplateParserConfig = {
            condition2: {
                key: 'condition2',
                parser: plainText,
                default: undefined,
            },
            condition2Duration: {
                key: 'condition2 duration',
                parser: int,
                default: undefined,
            },
            condition2Save: {
                key: 'condition2 save',
                parser: parseEnum(AbilityScore),
                default: undefined,
            },
        };

        const template = await this.page.getTemplate(this.templateName);
        Object.assign(this, template.parse(config));
        await this.parseCosts();
    }

    toJSON(): Partial<IAction> {
        const result: Partial<IAction> = super.toJSON();

        const keys: Array<keyof IAction> = [
            'condition2',
            'condition2Duration',
            'condition2Save',
        ];

        keys.forEach((key) => {
            if (key in this) {
                result[key] = this[key] as any;
            }
        });

        return result;
    }
}
