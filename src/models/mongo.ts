import { MongoClient } from 'mongodb';
import { CONFIG } from './config';

let mdb: any;

export enum MongoCollections {
    MW_PAGES = 'MW_PAGES',
    BUILDS = 'BUILDS',
}

export async function getMongoDb() {
    if (!mdb) {
        mdb = (async () => {
            const client = new MongoClient(
                `mongodb://${CONFIG.MONGO.USERNAME}:${CONFIG.MONGO.PASSWORD}@${CONFIG.MONGO.HOST}:${CONFIG.MONGO.PORT}`,
            );

            return client.db('mongodb');
        })();
    }

    return mdb;
}
