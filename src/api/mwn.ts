import { ApiPage, ApiParams, Mwn } from 'mwn';
import { memoizeWithExpiration } from '../models/utils';
import { CONFIG } from '../models/config';

type ApiParam =
    | string
    | string[]
    | boolean
    | number
    | number[]
    | Date
    | File
    | {
          stream: NodeJS.ReadableStream;
          name: string;
      };

const bot = new Mwn({
    apiUrl: 'https://bg3.wiki/w/api.php',
});

// shorthand just to reduce boilerplate
function memoize<T extends (...args: any[]) => any>(fn: T): T {
    return memoizeWithExpiration(CONFIG.MWN.MEMOIZATION_DURATION_IN_MILLIS, fn);
}

export class MwnApi {
    static queryTitlesFromCategory = memoize(
        async (
            categoryName: string,
            includeSubcategories: boolean = false,
        ): Promise<string[]> => {
            let titles: string[] = [];
            let cmcontinue: ApiParam;

            do {
                // eslint-disable-next-line no-await-in-loop
                const response = await bot.query({
                    list: 'categorymembers',
                    cmtitle: `Category:${categoryName}`,
                    cmlimit: 500, // maximum allowed for most users
                    // cmcontinue,
                });

                const members = response?.query?.categorymembers || [];

                // Filter out subcategories if not required
                const filteredMembers = includeSubcategories
                    ? members
                    : members.filter(
                          (member: any) =>
                              !member.title.startsWith('Category:'),
                      );

                titles = titles.concat(
                    filteredMembers.map((member: any) => member.title),
                );

                cmcontinue = response?.continue?.cmcontinue;
            } while (cmcontinue);

            return titles;
        },
    );

    static readPage = memoize(async (pageTitle: string): Promise<ApiPage> => {
        return bot.read(pageTitle);
    });

    static queryPages = memoize(
        async (
            pageTitles: string[],
            options: ApiParams,
        ): Promise<Record<string, Record<string, any>>> => {
            const responseData = await bot.query({
                titles: pageTitles,
                ...options,
            });

            if (!responseData?.query?.pages) {
                throw new Error('Could not find page data');
            }

            const pageData = responseData.query.pages as Record<
                string,
                Record<string, any>
            >;

            const entries = Object.values(pageData).map(
                (datum: Record<string, any>) => [datum.title, datum],
            );

            return Object.fromEntries(entries);
        },
    );

    static queryPage = memoize(
        async (
            pageTitle: string,
            options: ApiParams,
        ): Promise<Record<string, any>> => {
            const response = await this.queryPages([pageTitle], options);

            return response[pageTitle];
        },
    );
}

// (async () => {
//     await MwnApi.queryPage('Clericasdfa', {
//         prop: 'extracts',
//         exintro: true,
//         explaintext: true,
//     });
// })();
