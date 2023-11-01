import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { MediaWiki } from './media-wiki';
import { error, log } from './logger';
import { MwnTokenBucket } from '../api/mwn';

const ensureDirectoryExistence = async (filePath: string) => {
    const dirName = path.dirname(filePath);
    await fs.promises.mkdir(dirName, { recursive: true });
};

class StaticImageCacheServiceSingleton {
    private readonly imageCacheDir: string;
    private imagePromises: Array<Promise<void>> = [];

    constructor() {
        this.imageCacheDir = '../netherview/public';
    }

    enabled: boolean = false;
    checked: Record<string, true> = {};

    public async cacheImage(imageName: string): Promise<void> {
        const imagePromise = (async () => {
            try {
                if (!this.enabled) {
                    return;
                }

                if (this.checked[imageName]) {
                    return;
                }

                this.checked[imageName] = true;

                const localImagePath = path.join(
                    this.imageCacheDir,
                    MediaWiki.getImagePath(imageName),
                    imageName,
                );

                if (fs.existsSync(localImagePath)) {
                    return;
                }

                const remoteUrl =
                    await MediaWiki.resolveImageRedirect(imageName);
                await ensureDirectoryExistence(localImagePath);

                await MwnTokenBucket.acquireNTokens(4);

                const response = await new Promise<http.IncomingMessage>(
                    (resolve, reject) => {
                        https
                            .get(remoteUrl, (res) => {
                                if (
                                    res.statusCode &&
                                    (res.statusCode < 200 ||
                                        res.statusCode >= 300)
                                ) {
                                    reject(
                                        new Error(
                                            `Failed to fetch image: Status Code ${res.statusCode}`,
                                        ),
                                    );
                                } else {
                                    resolve(res);
                                }
                            })
                            .on('error', (err) => {
                                reject(err);
                            });
                    },
                );

                const writer = fs.createWriteStream(localImagePath);
                response.pipe(writer);

                await new Promise<void>((resolve, reject) => {
                    writer.on('finish', resolve);

                    writer.on('error', (err) => {
                        reject(err);
                    });
                });

                log(`Image cached successfully: ${imageName}`);
            } catch (err) {
                error(`Failed to cache image: ${imageName}`);
            }
        })();

        this.imagePromises.push(imagePromise);

        return imagePromise;
    }

    public async waitForAllImagesToCache(): Promise<void> {
        await Promise.all(this.imagePromises);
    }

    private async getAllFiles(dir: string): Promise<string[]> {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        const files = entries
            .filter((file) => !file.isDirectory())
            .map((file) => path.join(dir, file.name));

        const folders = entries.filter((folder) => folder.isDirectory());

        await Promise.all(
            folders.map(async (folder) => {
                files.push(
                    ...(await this.getAllFiles(path.join(dir, folder.name))),
                );
            }),
        );

        return files;
    }

    public async cleanupCache(): Promise<void> {
        try {
            const allFiles = await this.getAllFiles(
                path.join(this.imageCacheDir, 'media-wiki-assets'),
            );
            const filesToDelete = allFiles.filter(
                (file) => !this.checked[path.basename(file)],
            );

            await Promise.all(
                filesToDelete.map(async (file) => {
                    try {
                        await fs.promises.unlink(file);
                        log(`Image removed from cache: ${path.basename(file)}`);
                    } catch (err) {
                        error(
                            `Failed to remove image from cache: ${path.basename(
                                file,
                            )}`,
                        );
                    }
                }),
            );
        } catch (err) {
            error('Failed to cleanup image cache');
        }
    }
}

export const StaticImageCacheService = new StaticImageCacheServiceSingleton();
