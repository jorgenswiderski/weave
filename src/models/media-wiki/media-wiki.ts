/* eslint-disable max-classes-per-file */
import { ApiParams, ApiRevisionSlot } from 'mwn';
import { Db, MongoError } from 'mongodb';
import assert from 'assert';
import { MongoCollections, getMongoDb } from '../mongo';
import { CONFIG } from '../config';
import { MwnApi, MwnApiClass } from '../../api/mwn';
import { Utils } from '../utils';
import { RemoteImageError } from '../image-cache/types';
import { debug, error } from '../logger';
import { IPageData } from './types';
import { MediaWikiParser } from './wikitext-parser';
import { RevisionLock } from '../revision-lock/revision-lock';

export class PageData implements IPageData {
    title: string;
    revisionId: any;
    categories: string[];
    pageId: number;
    lastFetched: number;

    revid?: number;
    parentid?: number;
    minor?: boolean;
    userhidden?: true;
    anon?: true;
    user?: string;
    userid?: number;
    timestamp?: string;
    roles?: string[];
    commenthidden?: true;
    comment?: string;
    parsedcomment?: string;
    slots?: {
        main: ApiRevisionSlot;
        [slotname: string]: ApiRevisionSlot;
    };

    size?: number;
    sha1?: string;
    contentmodel?: string;
    contentformat?: string;
    content?: string;

    constructor(data: IPageData) {
        const { title, pageId, categories, lastFetched, ...rest } = data;
        Object.assign(this, rest);
        this.title = title;
        this.pageId = pageId;
        this.categories = categories;
        this.lastFetched = lastFetched;
    }

    hasCategory(categoryNames: string[] | string): boolean {
        // eslint-disable-next-line no-param-reassign
        categoryNames =
            typeof categoryNames === 'string' ? [categoryNames] : categoryNames;

        const formatted = categoryNames.map((cat) =>
            `Category:${cat}`.toLowerCase(),
        );

        return this.categories.some((category) =>
            formatted.includes(category.toLowerCase()),
        );
    }

    protected static async getTemplatesByName(
        templateNames: string[],
    ): Promise<PageData[]> {
        // eslint-disable-next-line @typescript-eslint/return-await
        return await Promise.all(
            templateNames.map((name) =>
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                MediaWiki.getPage(
                    `${name.startsWith('User:') ? '' : 'Template:'}${name}`,
                ),
            ),
        );
    }

    async hasTemplate(templateNames: string[] | string): Promise<boolean> {
        if (!this?.content) {
            return false;
        }

        // eslint-disable-next-line no-param-reassign
        templateNames =
            typeof templateNames === 'string' ? [templateNames] : templateNames;

        const searchTemplateIds = (
            await PageData.getTemplatesByName(templateNames)
        ).map(({ pageId }) => pageId);

        const commentless = MediaWikiParser.removeComments(this.content);

        const allTemplateNames = [
            ...commentless.matchAll(/{{(?:Template:)?([^|}]+)[\s\S]*?}}/g),
        ]
            .map((match) => match[1].trim())
            .filter((name) => {
                // check for  embedded variables like "{{DISPLAYTITLE}}" which aren't templates
                const varName = name.split(':')[0];

                return varName !== varName.toUpperCase();
            })
            .filter((name) => !name.match(/#[^|}]+:/));

        const uniqueTemplateNames = Array.from(new Set(allTemplateNames));

        const pageTemplateIds = (
            await PageData.getTemplatesByName(uniqueTemplateNames)
        ).map(({ pageId }) => pageId);

        return searchTemplateIds.some((id) => pageTemplateIds.includes(id));
    }
}

export class MediaWiki {
    protected static isPageThrottled(cachedPage: IPageData): boolean {
        if (CONFIG.MEDIAWIKI.USE_LOCKED_REVISIONS) {
            return true;
        }

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

        return currentTime - lastTime < throttle;
    }

    static titleRedirects = new Map<string, string>();
    static deadLinks = new Set<string>();

    static getPage = Utils.memoize(async function getPage(
        pageTitle: string,
        revisionId?: number,
    ): Promise<PageData> {
        assert(
            !pageTitle.match(/(?:{{)|(?:}})/),
            `Page title '${pageTitle}' should not include template syntax!`,
        );

        const db: Db = await getMongoDb();
        const pageCollection = db.collection(MongoCollections.MW_PAGES);

        // eslint-disable-next-line no-param-reassign
        pageTitle = MediaWiki.titleRedirects.get(pageTitle) ?? pageTitle;

        // Check if the page is cached
        const cachedPage = (await pageCollection.findOne({
            title: pageTitle,
        })) as unknown as IPageData | undefined;

        if (
            cachedPage &&
            (cachedPage.revisionId === revisionId ||
                (!revisionId && MediaWiki.isPageThrottled(cachedPage)))
        ) {
            return new PageData(cachedPage);
        }

        let latestRevisionId;
        let categories;
        let redirect;

        if (CONFIG.MEDIAWIKI.USE_LOCKED_REVISIONS) {
            redirect = RevisionLock.getPageRedirect(pageTitle);
        } else {
            ({ latestRevisionId, categories, redirect } =
                await MediaWiki.getPageInfo(pageTitle));
        }

        if (redirect) {
            MediaWiki.titleRedirects.set(pageTitle, redirect);

            return MediaWiki.getPage(redirect, revisionId);
        }

        if (CONFIG.MEDIAWIKI.USE_LOCKED_REVISIONS) {
            if (!RevisionLock.isDeadLink(pageTitle)) {
                error(`Could not find page '${pageTitle}'`);
            }

            throw new Error(`Content for page "${pageTitle}" not found`);
        }

        latestRevisionId = latestRevisionId!;
        categories = categories!;

        // Compare with locally stored revision ID
        if (
            cachedPage &&
            !revisionId &&
            cachedPage.revisionId >= latestRevisionId
        ) {
            await pageCollection.updateOne(
                { pageId: cachedPage.pageId },
                {
                    $set: {
                        lastFetched: Date.now(),
                    },
                },
            );

            return new PageData(cachedPage as unknown as IPageData);
        }

        const content = await MwnApi.readPage(pageTitle, revisionId);

        if (!content.revisions || !content.revisions[0]) {
            MediaWiki.deadLinks.add(pageTitle);
            throw new Error(`Content for page "${pageTitle}" not found`);
        }

        assert(
            content.revid === revisionId,
            'Content revid must match requested revisionId',
        );

        const data = {
            ...content.revisions[0],
            pageId: content.pageid,
            title: content.title,
            revisionId: content.revid ?? latestRevisionId,
            categories,
            lastFetched: Date.now(),
        };

        assert(
            typeof data.content === 'string',
            'Page content must be a string',
        );

        // Store or update the page content, revision ID, and categories in MongoDB
        try {
            const { pageId, ...rest } = data;

            await pageCollection.updateOne(
                { pageId },
                { $set: rest },
                { upsert: true },
            );

            debug(`Updated page '${content.title}'`);
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

        return new PageData(data);
    });

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

    protected static async getPageInfo(pageTitle: string): Promise<{
        latestRevisionId: number;
        categories: string[];
        redirect?: string;
    }> {
        const data = await MwnApi.queryPage(pageTitle, {
            prop: 'info|categories',
            inprop: 'watched',
            cllimit: 'max',
        });

        let lastrevid;
        let categories;
        let title;

        try {
            ({ lastrevid, categories, title } = data);
        } catch (err) {
            if (err instanceof Error) {
                err.message = `${err.message} (page title: ${pageTitle})`;
            }

            throw err;
        }

        // If the title was normalized, we can just grab the title right out of the data
        let redirect = pageTitle !== title ? title : undefined;

        // Otherwise its a "true" redirect and we need to fetch the real title
        if (!redirect && data.redirect) {
            redirect = await MwnApi.getRedirect(pageTitle);
        }

        return {
            latestRevisionId: lastrevid,
            categories:
                categories?.map((cat: Record<string, any>) => cat.title) || [],
            redirect,
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

    static async getTitlesInCategories(
        categories: string[],
        includeSubcategories: boolean = false,
    ): Promise<string[]> {
        const categoriesFormatted = categories.map(
            (category) => `Category:${category}`,
        );

        if (CONFIG.MEDIAWIKI.USE_LOCKED_REVISIONS) {
            const db = await getMongoDb();
            const collection = db.collection(MongoCollections.MW_PAGES);
            const query = { categories: { $in: categoriesFormatted } };

            const cursor = collection.find(query, {
                projection: { _id: 0, title: 1 },
            });

            const results = await cursor.toArray();

            return results.map((document) => document.title).sort();
        }

        const titleGroups = await Promise.all(
            categoriesFormatted.map((category) =>
                MwnApiClass.queryTitlesFromCategory(
                    category,
                    includeSubcategories,
                ),
            ),
        );

        const titles = Array.from(new Set(titleGroups.flat()));

        return titles.sort();
    }
}
