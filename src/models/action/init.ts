import { MediaWiki, PageData } from '../media-wiki/media-wiki';
import { Utils } from '../utils';
import { initActionData } from './action';
import { initSpellData } from './spell';

export async function initActionsAndSpells(): Promise<void> {
    const categories = [
        // can remove these once templates are done being revised
        // https://discord.com/channels/937803826583445565/1173678971213332550
        'Spells',
        'Class actions',

        'Actions',
        'Bonus actions',
        'Reactions',
        'Free actions',
        'Movement-expending actions',
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

    const spells = (
        await Utils.asyncFilter(uniquePages, (page) =>
            page.hasTemplate('SpellPage'),
        )
    ).map((page) => page.title);

    await Promise.all([initActionData(actions), initSpellData(spells)]);
}
