import { ApiParams, ApiRevision } from 'mwn';
import { Db } from 'mongodb';
import assert from 'assert';
import crypto from 'crypto';
import { MongoCollections, getMongoDb } from './mongo';
import { CONFIG } from './config';
import { MwnApi } from '../api/mwn';

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
            pageId: content.pageid,
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
                        pageId: content.pageid,
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

    static getEncodedImageName(imageName: string): string {
        return imageName.replace(/ /g, '_');
    }

    static getImagePath(imageName: string): string {
        const formattedImageName = MediaWiki.getEncodedImageName(imageName);
        const hash = crypto
            .createHash('md5')
            .update(formattedImageName)
            .digest('hex');

        return `/${hash[0]}/${hash[0]}${hash[1]}`;
    }

    // static getImagePath = (name: string) => name;

    // static async getSectionNumber(
    //     pageTitle: string,
    //     sectionTitle: string,
    // ): Promise<string | null> {
    //     const data = await MwnApiClass.parsePageSections(pageTitle, {});

    //     if (!data) {
    //         return null;
    //     }

    //     const section = data.find((s: any) => s.line === sectionTitle);

    //     return section?.number ?? null;
    // }

    // static async getSectionTextByName(
    //     pageTitle: string,
    //     sectionTitle: string,
    // ): Promise<string | null> {
    //     const sectionNumber = await MediaWiki.getSectionNumber(
    //         pageTitle,
    //         sectionTitle,
    //     );

    //     if (!sectionNumber) {
    //         throw new Error('could not find section number');
    //     }

    //     const text = await MediaWiki.getTextExtract(pageTitle, {
    //         section: sectionNumber,
    //     });

    //     return text;
    // }

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
            throw new Error('Image not found');
        }

        return page.imageinfo[0]?.thumburl ?? page.imageinfo[0].url;
    }
}

// (async () => {
//     log(await MediaWiki.getSectionTextByName('Dragonborn', 'Black Dragonborn'));
// })();
