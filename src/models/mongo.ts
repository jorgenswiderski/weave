import { MongoClient } from 'mongodb';

let mdb: any;

export enum MongoCollections {
    MW_PAGES = 'MW_PAGES',
}

export async function getMongoDb() {
    if (!mdb) {
        mdb = (async () => {
            const client = await MongoClient.connect(
                `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}`,
            );

            return client.db('mongodb');
        })();
    }

    return mdb;
}
