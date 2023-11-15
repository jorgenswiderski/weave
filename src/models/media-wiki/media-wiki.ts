import { ApiParams, ApiRevision } from 'mwn';
import { Db, MongoError } from 'mongodb';
import assert from 'assert';
import { MongoCollections, getMongoDb } from '../mongo';
import { CONFIG } from '../config';
import { MwnApi } from '../../api/mwn';
import { Utils } from '../utils';
import { RemoteImageError } from '../image-cache/types';
import { debug } from '../logger';

export interface PageData extends ApiRevision {
    title: string;
    revisionId: any;
    categories: any;
    pageId: number;
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

        const lastTime = cachedPage?.lastFetched || 0;
        // Add a %age variance to the the throttle to evenly distribute the cache rebuilding over time
        const variance = CONFIG.MEDIAWIKI.REVISION_CHECK_THROTTLE_VARIANCE;

        const rngFactor =
            1.0 + Utils.randomSeeded(lastTime) * variance * 2 - variance;

        const throttle =
            CONFIG.MEDIAWIKI.REVISION_CHECK_THROTTLE_IN_MILLIS * rngFactor;

        if (cachedPage && currentTime - lastTime < throttle) {
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
            pageId: content.pageid,
            title: pageTitle,
            revisionId: latestRevisionId,
            categories,
            lastFetched: currentTime,
        };

        assert(
            typeof data.content === 'string',
            'Page content must be a string',
        );

        // Store or update the page content, revision ID, and categories in MongoDB
        try {
            await pageCollection.updateOne(
                { title: pageTitle },
                {
                    $set: {
                        ...content.revisions[0],
                        pageId: content.pageid,
                        revisionId: latestRevisionId,
                        categories,
                        lastFetched: currentTime,
                    },
                },
                { upsert: true },
            );

            debug(`Updated page '${pageTitle}'`);
        } catch (err) {
            if (
                err instanceof MongoError &&
                err.code === 11000 /* Duplicate key */
            ) {
                // The upsert failed due to a unique index constraint being
                // violated by 2 or more concurrent insert operations
                //
                // Since readPage is memoized, the content of the document is
                // basically guaranteed to be identical to the data in this
                // context, so we can just do nothing
            } else {
                throw err;
            }
        }

        return data;
    }

    static stripMarkup(value: string): string {
        let v = value.replace(/\[\[File:([^|]*?)(?:\|[^|]+?)*\]\]/g, ''); // remove files
        v = v.replace(/\[\[.*?\|(.*?)\]\]/g, '$1'); // extract link labels
        v = v.replace(/\[\[(.*?)\]\]/g, '$1');
        v = v.replace(/{{Q\|(.*?)(?:\|.*?)?}}/g, '$1');
        v = v.replace(/\{\{([^|}]+?)\}\}/g, '$1');
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
            section?: string;
            plainText?: boolean;
        },
    ): Promise<string | null> {
        const params: ApiParams = {
            prop: 'extracts',
            exintro: options?.intro ?? false,
            explaintext: options?.plainText ?? true,
        };

        if (options.section) {
            params.section = options.section;

            if (options.plainText ?? true) {
                params.exsectionformat = 'plain';
            }
        }

        const data = await MwnApi.queryPage(pageTitle, params);

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

    static getImagePath: (imageName: string) => string = (imageName: string) =>
        Utils.getMediaWikiImagePath(imageName, false);

    static async resolveImageRedirect(
        imageName: string,
        width?: number,
    ): Promise<string> {
        // convert _ to spaces to account for some rareish bad data
        const params: any = {
            prop: 'imageinfo',
            iiprop: 'url',
            format: 'json',
        };

        if (width) {
            params.iiurlwidth = width;
        }

        const page = await MwnApi.queryPage(
            `File:${imageName.replace(/_/g, ' ')}`,
            params,
        );

        if (!page || !page.imageinfo || page.imageinfo.length === 0) {
            throw new RemoteImageError(404);
        }

        return page.imageinfo[0]?.thumburl ?? page.imageinfo[0].url;
    }
}
