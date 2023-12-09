import { MediaWiki, PageData } from '../media-wiki/media-wiki';
import { Utils } from '../utils';
import { Action } from './action';
import { initSpellData } from './spell';
import { WeaponAction } from './weapon-action';

let actionData: Action[];
let actionDataById: Map<number, Action> | null = null;

export async function initActionData(
    actionNames: string[],
    weaponActionNames: string[],
): Promise<void> {
    actionData = [
        ...actionNames.map((name) => new Action(name)),
        ...weaponActionNames.map((name) => new WeaponAction(name)),
    ];

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

export async function initActionsAndSpells(): Promise<void> {
    const categories = [
        'Actions',
        'Bonus actions',
        'Reactions',
        'Free actions',
        'Movement-expending actions',

        'Class actions', // some actions only cost a class resource (like a Superiority Die) and so technically are not "free actions"
    ];

    const actionNames = await MediaWiki.getTitlesInCategories(categories);

    const actionPages = await Promise.all(
        actionNames.map((name) => MediaWiki.getPage(name)),
    );

    // Prune duplicates that may be caused by redirects.
    const pageMap = new Map<number, PageData>();

    actionPages.forEach((page) => {
        if (page?.pageId) {
            pageMap.set(page.pageId, page);
        }
    });

    const uniquePages = [...pageMap.values()];

    const actions = (
        await Utils.asyncFilter(uniquePages, (page) =>
            page.hasTemplate('ActionPage'),
        )
    ).map((page) => page.title);

    const weaponActions = (
        await Utils.asyncFilter(uniquePages, (page) =>
            page.hasTemplate('WeaponActionPage'),
        )
    ).map((page) => page.title);

    const spells = (
        await Utils.asyncFilter(uniquePages, (page) =>
            page.hasTemplate('SpellPage'),
        )
    ).map((page) => page.title);

    await Promise.all([
        initActionData(actions, weaponActions),
        initSpellData(spells),
    ]);
}
