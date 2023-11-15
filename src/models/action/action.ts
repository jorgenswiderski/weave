import {
    ActionResource,
    IAction,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/action';
import { AbilityScore } from '@jorgenswiderski/tomekeeper-shared/dist/types/ability';
import { PageNotFoundError } from '../errors';
import {
    MediaWikiTemplateParser,
    MediaWikiTemplateParserConfig,
} from '../media-wiki/mw-template-parser';
import { ActionBase } from './action-base';

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

export async function initActionData(actionNames: string[]): Promise<void> {
    actionData = actionNames.map((name) => new Action(name));

    await Promise.all(
        actionData.map((action) => action.waitForInitialization()),
    );

    actionDataById = new Map<number, Action>();

    actionData.forEach((action) => {
        if (actionDataById!.has(action.id!)) {
            const other = actionDataById!.get(action.id!);
            throw new Error(
                `action data conflict between ${other?.name} (${other?.id}) and ${action.name} (${action.id})`,
            );
        }

        actionDataById!.set(action.id!, action);
    });
}

async function waitForInit(): Promise<void> {
    const executor = (resolve: any) => {
        if (actionData) {
            resolve();

            return;
        }

        setTimeout(() => executor(resolve), 500);
    };

    return new Promise(executor);
}

export async function getActionData(): Promise<Action[]> {
    await waitForInit();

    return actionData;
}

export async function getActionDataById() {
    await waitForInit();

    return actionDataById!;
}

export async function getActionDataFiltered(): Promise<Action[]> {
    const actions = await getActionData();

    return actions.filter((action) => action.used);
}
