import { ApiRevision } from 'mwn';
import { Db } from 'mongodb';
import { MongoCollections, getMongoDb } from './mongo';
import { MwnApi } from '../api/mwn';
import { log } from './logger';

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

        const { latestRevisionId, categories } =
            await MwnApi.fetchPageInfo(pageTitle);

        // Compare with locally stored revision ID
        if (cachedPage && cachedPage.revisionId >= latestRevisionId) {
            // log(`No newer revision of page ${pageTitle} available`);
            return cachedPage as unknown as PageData;
        }

        const content = await MwnApi.fetchPageContent(pageTitle);

        if (!content.revisions || !content.revisions[0]) {
            throw new Error(`Content for page "${pageTitle}" not found`);
        }

        const data = {
            ...content.revisions[0],
            title: pageTitle,
            revisionId: latestRevisionId,
            categories,
        };

        // Store or update the page content, revision ID, and categories in MongoDB
        if (cachedPage) {
            await pageCollection.updateOne(
                { title: pageTitle },
                {
                    $set: {
                        content: content.revisions[0],
                        revisionId: latestRevisionId,
                        categories,
                    },
                },
            );
            log(`Updated page "${pageTitle}" contents`);
        } else {
            await pageCollection.insertOne(data);
            // log(`Fetched page "${pageTitle}" contents`);
        }

        return data;
    }
}
