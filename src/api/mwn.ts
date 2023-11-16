import { ApiPage, ApiParams, ApiResponse, Mwn } from 'mwn';
import { Utils } from '../models/utils';
import { CONFIG } from '../models/config';
import { TokenBucket } from '../models/token-bucket';
import { ApiParam, RequestBatch } from './request-batch';
import { PageNotFoundError } from '../models/errors';

const bot = new Mwn({
    apiUrl: `${CONFIG.MEDIAWIKI.BASE_URL}/api.php`,
});

export const MwnTokenBucket = new TokenBucket(100, 3);

// shorthand just to reduce boilerplate
function memoize<T extends (...args: any[]) => Promise<any>>(fn: T): T {
    // const tokenAcquiringFunction = async (...args: any[]) => {
    //     await bucket.acquireToken();
    //     log(bucket.lifetimeTokens);

    //     return fn(...args);
    // };

    return Utils.memoizeWithExpiration(
        CONFIG.MWN.MEMOIZATION_DURATION_IN_MILLIS,
        // tokenAcquiringFunction,
        fn,
    ) as T;
}

export class MwnApiClass {
    private batches: Record<string, RequestBatch> = {};

    static batchAxisMap: { [key: string]: string } = {
        titles: 'title',
    };

    private queryWithBatchingAcross = memoize(
        async (
            batchAxis: keyof ApiParams,
            queryParameters: ApiParams,
        ): Promise<ApiResponse> => {
            let values = queryParameters[batchAxis];
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const { [batchAxis]: _, ...restOfParams } = queryParameters;
            const queryKey = JSON.stringify({ axis: batchAxis, restOfParams });

            const inputs = Array.isArray(values) ? values : [values];

            if (!this.batches[queryKey]) {
                this.batches[queryKey] = new RequestBatch(
                    this.batches,
                    bot,
                    MwnTokenBucket,
                    queryKey,
                    batchAxis,
                    restOfParams,
                );
            }

            const outputs = this.batches[queryKey].addInputs([...inputs]);

            const datas = await Promise.all(outputs);

            // stitch the data from multiple requests together
            const data = {
                ...datas[0],
                query: {
                    ...datas[0].query,
                    normalized: datas.flatMap((d) => d.query?.normalized ?? []),
                    pages: datas.flatMap((d) => d.query?.pages),
                },
            };

            if (MwnApiClass.batchAxisMap[batchAxis] === 'title') {
                const values2 = (
                    typeof values === 'string' ? [values] : values
                ) as string[];

                values = values2.map((title) => {
                    const entry = data.query.normalized?.find(
                        ({ from }) => from === title,
                    );

                    return entry?.to ?? title;
                });
            }

            return {
                ...data,
                query: {
                    ...data.query,
                    pages: data.query?.pages.filter((page: any) =>
                        typeof values === 'string'
                            ? page[MwnApiClass.batchAxisMap[batchAxis]] ===
                              values
                            : (values as string[]).includes(
                                  page[MwnApiClass.batchAxisMap[batchAxis]],
                              ),
                    ),
                },
            };
        },
    );

    static async queryTitlesFromCategory(
        categoryName: string,
        includeSubcategories: boolean = false,
    ): Promise<string[]> {
        let titles: string[] = [];
        let cmcontinue: ApiParam | null = null;

        do {
            // eslint-disable-next-line no-await-in-loop
            await MwnTokenBucket.acquireToken();

            const params: ApiParams = {
                list: 'categorymembers',
                cmtitle: `Category:${categoryName}`,
                cmlimit: 500, // maximum allowed for most users
            };

            if (cmcontinue) {
                params.cmcontinue = cmcontinue;
            }

            // eslint-disable-next-line no-await-in-loop
            const response = await bot.query(params);

            const members = response?.query?.categorymembers || [];

            // Filter out subcategories if not required
            const filteredMembers = includeSubcategories
                ? members
                : members.filter(
                      (member: any) => !member.title.startsWith('Category:'),
                  );

            titles = titles.concat(
                filteredMembers.map((member: any) => member.title),
            );

            cmcontinue = response?.continue?.cmcontinue;
        } while (cmcontinue);

        return titles;
    }

    readPage = memoize(async (pageTitle: string): Promise<ApiPage> => {
        await MwnTokenBucket.acquireToken();

        return bot.read(pageTitle);
    });

    async queryPages(
        pageTitles: string[],
        options: ApiParams,
    ): Promise<Record<string, Record<string, any>>> {
        const responseData = await this.queryWithBatchingAcross('titles', {
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

        const data = Object.fromEntries(entries);

        // Add a reference to normalized results by the pre-normalized page title name
        if (responseData.query.normalized) {
            responseData.query.normalized.forEach(
                ({ from, to }: { from: string; to: string }) => {
                    if (pageTitles.includes(from)) {
                        data[from] = data[to];
                    }
                },
            );
        }

        return data;
    }

    queryPage = memoize(
        async (
            pageTitle: string,
            options: ApiParams,
        ): Promise<Record<string, any>> => {
            const response = await this.queryPages([pageTitle], options);

            return response[pageTitle];
        },
    );

    // static async parsePageSections(pageTitle: string, options: ApiParams) {
    //     const response = await bot.request({
    //         action: 'parse',
    //         page: pageTitle,
    //         prop: 'sections',
    //         ...options,
    //     });

    //     return response?.parse?.sections;
    // }

    queryCategoriesFromPage = async (
        pageTitle: string,
    ): Promise<{ titles: string[]; includes: (name: string) => boolean }> => {
        const data = await this.queryWithBatchingAcross('titles', {
            prop: 'categories',
            titles: pageTitle,
            cllimit: 'max',
        });

        if (!data.query?.pages?.[0]) {
            throw new PageNotFoundError(`could not find page for ${pageTitle}`);
        }

        const categories = data.query.pages[0].categories || [];

        const categoryTitles: string[] = categories.map(
            (cat: any) => cat.title,
        );

        // custom includes implementation for case insensitivity
        // reduces copy paste later

        const lowercasedTitles = categoryTitles.map((name) =>
            name.toLowerCase(),
        );

        return {
            titles: categoryTitles,
            includes: (categoryName: string) => {
                return lowercasedTitles.includes(categoryName.toLowerCase());
            },
        };
    };
}

export const MwnApi = new MwnApiClass();
