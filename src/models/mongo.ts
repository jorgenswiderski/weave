import { Db, MongoClient } from 'mongodb';
import { CONFIG } from './config';
import { error, log } from './logger';

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

// eslint-disable-next-line consistent-return
async function initConnection(): Promise<Db> {
    try {
        log(`Connecting to tome...`);

        const client = new MongoClient(
            `mongodb://${CONFIG.MONGO.USERNAME}:${CONFIG.MONGO.PASSWORD}@${CONFIG.MONGO.HOST}:${CONFIG.MONGO.PORT}`,
        );

        const db = client.db('mongodb');
        await initCollections(db);

        log(`Successfully connected to tome!`);

        return db;
    } catch (err) {
        error(
            `Failed to connect to mongodb:\n\t${err}\nPlease check that the db is running and try again.`,
        );

        process.exit(1);
    }
}

export async function getMongoDb() {
    if (!mdb) {
        mdb = initConnection();
    }

    return mdb;
}
