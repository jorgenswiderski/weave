import { ApiPage, Mwn } from 'mwn';
import { MongoCollections, getMongoDb } from '../mongo';
import { Db } from 'mongodb';

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

export class mwnApi {
    static fetchTitlesFromCategory = async (
        categoryName: string,
        includeSubcategories: boolean = false,
    ): Promise<string[]> => {
        let titles: string[] = [];
        let cmcontinue: ApiParam;

        do {
            const response = await bot.request({
                action: 'query',
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
                      (member: any) => !member.title.startsWith('Category:'),
                  );

            titles = titles.concat(
                filteredMembers.map((member: any) => member.title),
            );

            cmcontinue = response?.continue?.cmcontinue;
        } while (cmcontinue);

        return titles;
    };

    // Fetches the revision ID and categories of a page
    static async fetchPageInfo(pageTitle: string) {
        const pageInfo = await bot.query({
            titles: pageTitle,
            prop: 'info|categories',
            inprop: 'watched',
            cllimit: 'max',
        });

        const latestRevisionId =
            pageInfo?.query?.pages[Object.keys(pageInfo?.query?.pages)[0]]
                .lastrevid;

        const categories =
            pageInfo?.query?.pages[
                Object.keys(pageInfo?.query?.pages)[0]
            ].categories?.map((category: any) => category.title) || [];

        return { latestRevisionId, categories };
    }

    // Reads the content of a page
    static async fetchPageContent(pageTitle: string) {
        return await bot.read(pageTitle);
    }
}
