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

class ImageCacheServiceSingleton {
    private readonly imageCacheDir: string;

    constructor() {
        this.imageCacheDir = 'static-image-cache';
    }

    enabled: boolean = false;
    checked: Record<string, true> = {};

    public async cacheImage(imageName: string): Promise<void> {
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

            const oldImagePath = path.join(this.imageCacheDir, imageName);

            if (fs.existsSync(oldImagePath)) {
                await ensureDirectoryExistence(localImagePath);
                await fs.promises.rename(oldImagePath, localImagePath);

                return;
            }

            if (fs.existsSync(localImagePath)) {
                return;
            }

            const remoteUrl = await MediaWiki.resolveImageRedirect(imageName);
            await ensureDirectoryExistence(localImagePath);

            await MwnTokenBucket.acquireNTokens(6);

            const response = await new Promise<http.IncomingMessage>(
                (resolve, reject) => {
                    https
                        .get(remoteUrl, (res) => {
                            if (
                                res.statusCode &&
                                (res.statusCode < 200 || res.statusCode >= 300)
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
    }
}

export const ImageCacheService = new ImageCacheServiceSingleton();
