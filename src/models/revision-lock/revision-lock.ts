import fs from 'fs';
import { MongoCollections, getMongoDb } from '../mongo';

class RevisionLockSingleton {
    redirects: Map<string, string>;

    constructor() {
        this.redirects = this.loadRedirects();
    }

    protected static async write(data: any, path: string): Promise<void> {
        await fs.promises.mkdir(path.split('/').slice(0, -1).join('/'), {
            recursive: true,
        });

        await fs.promises.writeFile(path, JSON.stringify(data, null, 4));
    }

    redirectsPath = 'data-dump/redirects.json';

    protected loadRedirects(): Map<string, string> {
        try {
            const jsonStr = fs.readFileSync(this.redirectsPath, 'utf-8');
            const redirectObj = JSON.parse(jsonStr);

            return new Map<string, string>(Object.entries(redirectObj));
        } catch (err) {
            return new Map<string, string>();
        }
    }

    async saveRedirects(redirectMap: Map<string, string>): Promise<void> {
        const redirects = Object.fromEntries(
            [...redirectMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
        );

        await RevisionLockSingleton.write(redirects, this.redirectsPath);
    }

    getPageRedirect(pageTitle: string): string | undefined {
        return this.redirects.get(pageTitle);
    }

    revisionsPath = 'data-dump/revision-lock.json';

    // eslint-disable-next-line class-methods-use-this
    async saveRevisions(): Promise<void> {
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

        const data = await cursor.toArray();

        await RevisionLockSingleton.write(
            data.sort((a, b) => a.pageId - b.pageId),
            this.revisionsPath,
        );
    }
}

export const RevisionLock = new RevisionLockSingleton();
