// builds.ts
import { v4 as uuid } from 'uuid';
import { Db, WithId } from 'mongodb';
import { Build, BuildId, BuildWithInfo } from 'planner-types/src/types/builds';
import { CONFIG } from '../config';
import {
    BuildDataTooLargeError,
    BuildNotFoundError,
    TooManyRequestsError,
} from './types';
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

    private static async countRecentBuildsByUser(ip: string): Promise<number> {
        const collection = await this.getCollection();
        const windowStart = new Date(
            Date.now() - CONFIG.BUILDS.RECENCY_WINDOW_IN_MILLIS,
        );

        return collection.countDocuments({
            ip,
            createdUtc: { $gte: windowStart.getTime() },
        });
    }

    static async create(
        encodedData: string,
        buildVersion: string,
        ip: string,
    ): Promise<BuildId> {
        this.checkBuildLength(encodedData, buildVersion);

        const userBuildCount = await this.countRecentBuildsByUser(ip);

        if (userBuildCount >= CONFIG.BUILDS.MAX_BUILD_CREATED_RECENTLY) {
            throw new TooManyRequestsError(
                'User has created too many builds recently',
            );
        }

        const collection = await this.getCollection();
        const buildId = uuid();

        const build: BuildWithInfo = {
            encoded: encodedData,
            id: buildId,
            version: buildVersion,
            createdUtc: Date.now(),
            lastAccessedUtc: Date.now(),
            lastModifiedUtc: Date.now(),
            hits: 0,
            ip,
        };

        await collection.insertOne(build);

        return buildId;
    }

    static async delete(id: BuildId, ip: string): Promise<void> {
        const collection = await this.getCollection();
        const result = await collection.deleteOne({ id, ip });

        if (result.deletedCount === 0) {
            throw new BuildNotFoundError(
                'Could not find a build with that id and IP address',
            );
        }
    }

    static async update(
        id: BuildId,
        encodedData: string,
        buildVersion: string,
        ip: string,
    ): Promise<void> {
        this.checkBuildLength(encodedData, buildVersion);

        const collection = await this.getCollection();
        const result = await collection.updateOne(
            { id, ip },
            {
                $set: {
                    encoded: encodedData,
                    version: buildVersion,
                    lastAccessedUtc: Date.now(),
                },
            },
        );

        if (result.modifiedCount === 0) {
            throw new BuildNotFoundError(
                'Could not find a build with that id and IP address',
            );
        }
    }

    static async get(id: BuildId): Promise<Build> {
        const collection = await this.getCollection();

        const build = (await collection.findOneAndUpdate(
            { id },
            {
                $inc: { hits: 1 },
                $set: { lastAccessedUtc: Date.now() },
            },
            { returnDocument: 'before' },
        )) as WithId<BuildWithInfo> | null;

        if (!build) {
            throw new BuildNotFoundError(
                'Could not find a build to fetch with that id',
            );
        }

        const { encoded, version } = build;

        return { encoded, version, id };
    }
}
