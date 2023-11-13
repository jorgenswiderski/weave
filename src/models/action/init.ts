import { MwnApiClass } from '../../api/mwn';
import { MediaWiki, PageData } from '../media-wiki';
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
    ];

    const actionNames = [
        ...new Set(
            (
                await Promise.all(
                    categories.map((category) =>
                        MwnApiClass.queryTitlesFromCategory(category),
                    ),
                )
            ).flat(),
        ),
    ];

    const actionPages = await Promise.all(actionNames.map(MediaWiki.getPage));

    // Prune duplicates that may be caused by redirects.
    const pageMap = new Map<number, PageData>();

    actionPages.forEach((page) => {
        if (page?.pageId) {
            pageMap.set(page.pageId, page);
        }
    });

    const uniquePages = [...pageMap.values()];

    const actions = uniquePages
        .filter((page) => page?.content?.includes('{{ActionPage'))
        .map((page) => page?.title!);

    const spells = uniquePages
        .filter((page) => page?.content?.includes('{{SpellPage'))
        .map((page) => page?.title!);

    await Promise.all([initActionData(actions), initSpellData(spells)]);
}
