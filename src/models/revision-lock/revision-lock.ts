import fs from 'fs';
import { Collection, Document } from 'mongodb';
import assert from 'assert';
import { MongoCollections, getMongoDb } from '../mongo';
import { RevisionLockEntry, RevisionLockInfo } from './types';
import { log } from '../logger';
import { CONFIG } from '../config';
import { Utils } from '../utils';

class RevisionLockSingleton {
    redirects: Map<string, string>;
    deadLinks: Set<string>;
    revisions: RevisionLockEntry[];

    constructor() {
        const { redirects, deadLinks, revisions } = this.load();
        this.redirects = redirects;
        this.deadLinks = deadLinks;
        this.revisions = revisions;
    }

    protected static async write(data: any, path: string): Promise<void> {
        await fs.promises.mkdir(path.split('/').slice(0, -1).join('/'), {
            recursive: true,
        });

        await fs.promises.writeFile(path, JSON.stringify(data, null, 4));
    }

    path = 'data-dump/revision-lock.json';

    protected load(): {
        redirects: Map<string, string>;
        deadLinks: Set<string>;
        revisions: RevisionLockEntry[];
    } {
        try {
            const jsonStr = fs.readFileSync(this.path, 'utf-8');
            const lockData = JSON.parse(jsonStr) as RevisionLockInfo;

            const redirectObj = lockData.redirects;

            const redirects = new Map<string, string>(
                Object.entries(redirectObj),
            );

            const deadLinks = new Set<string>(lockData.deadLinks);

            return { redirects, deadLinks, revisions: lockData.revisions };
        } catch (err) {
            return {
                redirects: new Map<string, string>(),
                deadLinks: new Set<string>(),
                revisions: [],
            };
        }
    }

    static getRedirects(
        redirectMap: Map<string, string>,
    ): Record<string, string> {
        return Object.fromEntries(
            [...redirectMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
        );
    }

    getPageRedirect(pageTitle: string): string | undefined {
        return this.redirects.get(pageTitle);
    }

    isDeadLink(pageTitle: string): boolean {
        return this.deadLinks.has(pageTitle);
    }

    static appStart = Date.now();

    protected static async prunePages(): Promise<void> {
        const db = await getMongoDb();
        const collection = db.collection(MongoCollections.MW_PAGES);

        const results = await collection.deleteMany({
            $or: [
                { lastAccessed: { $lt: this.appStart } },
                { lastAccessed: { $exists: false } }, // Can remove this after deploy
            ],
        });

        if (results.deletedCount > 0) {
            log(`Pruned ${results.deletedCount} unused pages.`);
        }
    }

    protected async updateRevisions(): Promise<void> {
        const db = await getMongoDb();
        const collection = db.collection(MongoCollections.MW_PAGES);

        const cursor = collection.find(
            {},
            {
                projection: {
                    _id: 0,
                    pageId: 1,
                    title: 1,
                    revisionId: 1,
                },
            },
        );

        const data = (await cursor.toArray()) as unknown as RevisionLockEntry[];

        this.revisions = (
            data.map((datum) =>
                Object.fromEntries(
                    Object.entries(datum).sort((a, b) =>
                        a[0] < b[0] ? -1 : 1,
                    ),
                ),
            ) as RevisionLockEntry[]
        ).sort((a, b) => a.pageId - b.pageId);
    }

    async save(
        redirectMap: Map<string, string>,
        deadLinks: Set<string>,
    ): Promise<void> {
        await RevisionLockSingleton.prunePages();
        await this.updateRevisions();

        const data = {
            redirects: RevisionLockSingleton.getRedirects(redirectMap),
            revisions: this.revisions,
            deadLinks: Array.from(deadLinks).sort(),
        };

        await RevisionLockSingleton.write(data, this.path);
    }

    async getRevisionMismatches(collection: Collection<Document>) {
        return Utils.asyncFilter(this.revisions, async (lock) => {
            assert(
                typeof lock.title === 'string',
                `Expected title to be defined for lock on page ${lock.pageId}`,
            );

            assert(
                typeof lock.pageId === 'number',
                `Expected pageId to be defined for lock on page ${lock.title}`,
            );

            assert(
                typeof lock.revisionId === 'number',
                `Expected revisionId to be defined for lock on page ${lock.title}`,
            );

            const document = await collection!.findOne(lock);

            return !document;
        });
    }

    async validateDatabaseState(): Promise<void> {
        if (!CONFIG.MEDIAWIKI.USE_LOCKED_REVISIONS) {
            return;
        }

        const db = await getMongoDb();
        const collection = db.collection(MongoCollections.MW_PAGES);

        const mismatches = await this.getRevisionMismatches(collection);

        assert(
            mismatches.length === 0,
            `Database state does not match revision lock, ${mismatches.length} mismatches found.
            Run 'npm run load-revisions' or disable USE_LOCKED_REVISIONS in config.`,
        );
    }
}

export const RevisionLock = new RevisionLockSingleton();
