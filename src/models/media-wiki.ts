import { ApiRevision } from 'mwn';
import { Db } from 'mongodb';
import assert from 'assert';
import { MongoCollections, getMongoDb } from './mongo';
import { MwnApi } from '../api/mwn';
import { CONFIG } from './config';

export interface PageData extends ApiRevision {
    title: string;
    revisionId: any;
    categories: any;
}

export class MediaWiki {
    static async getPage(pageTitle: string): Promise<PageData | null> {
        const db: Db = await getMongoDb();
        const pageCollection = db.collection(MongoCollections.MW_PAGES);

        // Check if the page is cached
        const cachedPage = await pageCollection.findOne({ title: pageTitle });

        // If the page is cached and it's been fewer than N seconds since the last fetch,
        // just return the cached content.
        const currentTime = Date.now();

        if (
            cachedPage &&
            currentTime - (cachedPage.lastFetched || 0) <
                CONFIG.MEDIAWIKI.REVISION_CHECK_THROTTLE_IN_MILLIS
        ) {
            return cachedPage as unknown as PageData;
        }

        const { latestRevisionId, categories } =
            await MediaWiki.getPageInfo(pageTitle);

        // Compare with locally stored revision ID
        if (cachedPage && cachedPage.revisionId >= latestRevisionId) {
            await pageCollection.updateOne(
                { title: pageTitle },
                {
                    $set: {
                        lastFetched: currentTime,
                    },
                },
            );

            return cachedPage as unknown as PageData;
        }

        const content = await MwnApi.readPage(pageTitle);

        if (!content.revisions || !content.revisions[0]) {
            throw new Error(`Content for page "${pageTitle}" not found`);
        }

        const data = {
            ...content.revisions[0],
            title: pageTitle,
            revisionId: latestRevisionId,
            categories,
            lastFetched: currentTime,
        };

        assert(
            typeof data.content === 'string' && 'Page content must be a string',
        );

        // Store or update the page content, revision ID, and categories in MongoDB
        if (cachedPage) {
            await pageCollection.updateOne(
                { title: pageTitle },
                {
                    $set: {
                        ...content.revisions[0],
                        revisionId: latestRevisionId,
                        categories,
                        lastFetched: currentTime,
                    },
                },
            );
        } else {
            await pageCollection.insertOne(data);
        }

        return data;
    }

    static stripMarkup(value: string): string {
        let v = value.replace(/\[\[.*?\|(.*?)\]\]/g, '$1'); // extract link labels
        v = v.replace(/\[\[(.*?)\]\]/g, '$1');
        v = v.replace(/{{.*?\|(.*?)}}/g, '$1'); // extract template parameters
        v = v.replace(/'''(.*?)'''/g, '$1'); // bold text
        v = v.replace(/''(.*?)''/g, '$1'); // italic text
        v = v.replace(/`/g, ''); // backticks
        v = v.replace(/<.*?>/g, ''); // strip out any html tags
        v = v.replace(/style=".*?" \| /g, ''); // strip out style attributes
        v = v.replace(/(\w+)\.webp|\.png/g, '$1'); // remove image extensions
        v = v.trim(); // remove spaces from start and end

        return v;
    }

    static async getTextExtract(
        pageTitle: string,
        options: {
            intro?: boolean;
            plainText?: boolean;
        },
    ): Promise<string | null> {
        const data = await MwnApi.queryPage(pageTitle, {
            prop: 'extracts',
            exintro: options?.intro ?? false,
            explaintext: options?.plainText ?? true,
        });

        return data?.extract ?? null;
    }

    static async getPageInfo(pageTitle: string): Promise<{
        latestRevisionId: number;
        categories: string[];
    }> {
        const data = await MwnApi.queryPage(pageTitle, {
            prop: 'info|categories',
            inprop: 'watched',
            cllimit: 'max',
        });

        const { lastrevid, categories } = data;

        return {
            latestRevisionId: lastrevid,
            categories:
                categories?.map((cat: Record<string, any>) => cat.title) || [],
        };
    }
}
