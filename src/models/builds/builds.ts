import { v4 as uuid } from 'uuid';
import { Db, WithId } from 'mongodb';
import { Build, BuildId, BuildWithInfo } from 'planner-types/src/types/builds';
import { CONFIG } from '../config';
import { BuildDataTooLargeError, BuildNotFoundError } from './types';
import { MongoCollections, getMongoDb } from '../mongo';

export class Builds {
    private static checkBuildLength(
        encodedData: string,
        buildVersion: string,
    ): void {
        if (
            encodedData.length + buildVersion.length >
            CONFIG.BUILDS.MAX_ENCODED_BUILD_LENGTH
        ) {
            throw new BuildDataTooLargeError(
                `The provided data exceeds the maximum length of ${CONFIG.BUILDS.MAX_ENCODED_BUILD_LENGTH} (${encodedData.length})`,
            );
        }
    }

    private static async getCollection() {
        const db: Db = await getMongoDb();

        return db.collection(MongoCollections.BUILDS);
    }

    static async create(
        encodedData: string,
        buildVersion: string,
    ): Promise<BuildId> {
        this.checkBuildLength(encodedData, buildVersion);

        const collection = await this.getCollection();
        const buildId = uuid();

        const build: BuildWithInfo = {
            encoded: encodedData,
            id: buildId,
            version: buildVersion,
            createdUtc: Date.now(),
            hits: 0,
        };

        await collection.insertOne(build);

        return buildId;
    }

    static async delete(id: BuildId): Promise<void> {
        const collection = await this.getCollection();

        await collection.deleteOne({ id });
    }

    static async update(
        id: BuildId,
        encodedData: string,
        buildVersion: string,
    ): Promise<void> {
        this.checkBuildLength(encodedData, buildVersion);

        const collection = await this.getCollection();
        const build: Partial<BuildWithInfo> = {
            encoded: encodedData,
            version: buildVersion,
        };

        const result = await collection.updateOne({ id }, build);

        if (result.modifiedCount === 0) {
            throw new BuildNotFoundError(
                'Could not find a build to update with that id',
            );
        }
    }

    static async get(id: BuildId): Promise<Build> {
        const collection = await this.getCollection();

        const build = (await collection.findOne({
            id,
        })) as WithId<BuildWithInfo> | null;

        if (!build) {
            throw new BuildNotFoundError(
                'Could not find a build to fetch with that id',
            );
        }

        const { encoded, version } = build;

        return { encoded, version, id };
    }
}
