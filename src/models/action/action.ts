import { ActionResource, IAction } from 'planner-types/src/types/action';
import { AbilityScore } from 'planner-types/src/types/ability';
import { PageNotFoundError } from '../errors';
import {
    MediaWikiTemplateParser,
    MediaWikiTemplateParserConfig,
} from '../mw-template-parser';
import { ActionBase } from './action-base';
import { MwnApiClass } from '../../api/mwn';

let actionData: Action[];
let actionDataById: Map<number, Action> | null = null;

export class Action extends ActionBase implements Partial<IAction> {
    condition2?: string;
    condition2Duration?: number;
    condition2Save?: AbilityScore;

    protected async initData(): Promise<void> {
        await super.initData();

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        const { plainText, int } = MediaWikiTemplateParser.Parsers;
        const { parseEnum } = MediaWikiTemplateParser.HighOrderParsers;

        const config: Record<string, MediaWikiTemplateParserConfig> = {
            cost: {
                key: 'cost',
                parser: parseEnum(ActionResource),
                default: undefined,
            },
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

        Object.assign(
            this,
            MediaWikiTemplateParser.parseTemplate(this.page, config),
        );
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

export async function getActionData(): Promise<Action[]> {
    if (!actionData) {
        const actionNames =
            await MwnApiClass.queryTitlesFromCategory('Actions');
        const spellNames = await MwnApiClass.queryTitlesFromCategory('Spells');

        actionData = actionNames
            .filter((name) => !spellNames.includes(name))
            .map((name) => new Action(name));

        await Promise.all(
            actionData.map((action) => action.waitForInitialization()),
        );

        actionDataById = new Map<number, Action>();
        actionData.forEach((action) => actionDataById!.set(action.id!, action));
    }

    return actionData;
}

export async function getActionDataById() {
    if (!actionDataById) {
        await getActionData();
    }

    return actionDataById!;
}
