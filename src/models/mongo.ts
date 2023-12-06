import { Db, MongoClient } from 'mongodb';
import { CONFIG } from './config';

let mdb: Promise<Db>;

export const MongoCollections = {
    MW_PAGES: 'MW_PAGES',
    BUILDS: 'BUILDS',
};

export async function initPagesCollection(db: Db): Promise<void> {
    const pageCollection = db.collection(MongoCollections.MW_PAGES);

    await Promise.all(
        ['title', 'pageId'].map((index) =>
            pageCollection.createIndex(
                { [index]: 1 },
                {
                    unique: true,
                },
            ),
        ),
    );
}

async function initCollections(db: Db): Promise<void> {
    return initPagesCollection(db);
}

export async function getMongoDb() {
    if (!mdb) {
        mdb = (async () => {
            const client = new MongoClient(
                `mongodb://${CONFIG.MONGO.USERNAME}:${CONFIG.MONGO.PASSWORD}@${CONFIG.MONGO.HOST}:${CONFIG.MONGO.PORT}`,
            );

            const db = client.db('mongodb');
            await initCollections(db);

            return db;
        })();
    }

    return mdb;
}
