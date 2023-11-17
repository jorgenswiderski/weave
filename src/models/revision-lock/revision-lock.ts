import fs from 'fs';
import { MongoCollections, getMongoDb } from '../mongo';
import { RevisionLockEntry, RevisionLockInfo } from './types';

class RevisionLockSingleton {
    redirects: Map<string, string>;
    deadLinks: Set<string>;

    constructor() {
        const { redirects, deadLinks } = this.loadRedirects();
        this.redirects = redirects;
        this.deadLinks = deadLinks;
    }

    protected static async write(data: any, path: string): Promise<void> {
        await fs.promises.mkdir(path.split('/').slice(0, -1).join('/'), {
            recursive: true,
        });

        await fs.promises.writeFile(path, JSON.stringify(data, null, 4));
    }

    protected loadRedirects(): {
        redirects: Map<string, string>;
        deadLinks: Set<string>;
    } {
        try {
            const jsonStr = fs.readFileSync(this.path, 'utf-8');
            const lockData = JSON.parse(jsonStr) as RevisionLockInfo;

            const redirectObj = lockData.redirects;

            const redirects = new Map<string, string>(
                Object.entries(redirectObj),
            );

            const deadLinks = new Set<string>(lockData.deadLinks);

            return { redirects, deadLinks };
        } catch (err) {
            return {
                redirects: new Map<string, string>(),
                deadLinks: new Set<string>(),
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

    path = 'data-dump/revision-lock.json';

    protected static async getRevisions(): Promise<RevisionLockEntry[]> {
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

        return data.sort((a, b) => a.pageId - b.pageId);
    }

    async save(
        redirectMap: Map<string, string>,
        deadLinks: Set<string>,
    ): Promise<void> {
        const data = {
            redirects: RevisionLockSingleton.getRedirects(redirectMap),
            revisions: await RevisionLockSingleton.getRevisions(),
            deadLinks: Array.from(deadLinks).sort(),
        };

        await RevisionLockSingleton.write(data, this.path);
    }
}

export const RevisionLock = new RevisionLockSingleton();
