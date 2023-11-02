import path from 'path';
import fs from 'fs';
import https from 'https';
import { IncomingMessage } from 'http';
import writeFileAtomic from 'write-file-atomic';
import { MediaWiki } from './media-wiki';
import { MwnTokenBucket } from '../api/mwn';
import { CONFIG } from './config';
import { error } from './logger';

interface ImageCacheResponse {
    isUnknownSize?: boolean;
}

interface ResponseImage extends ImageCacheResponse {
    file: string;
}

interface ResponseRedirect extends ImageCacheResponse {
    redirect: string;
}

export class ImageCacheModel {
    static rootDir = path.dirname(require.main!.filename);
    static IMAGE_CACHE_DIR = path.join(this.rootDir, 'cache');

    // Local Cache: Off
    static cachedResponses: { [imageKey: string]: ResponseRedirect } = {};
    static preloadSizesPath = path.join(
        this.IMAGE_CACHE_DIR,
        'preload-sizes.json',
    );
    static preloadSizes: { [imageName: string]: number } = {};

    static async loadPreloadSizes(): Promise<void> {
        try {
            await this.ensureDirectoryExistence(this.preloadSizesPath);

            const data = await fs.promises.readFile(
                this.preloadSizesPath,
                'utf-8',
            );

            this.preloadSizes = JSON.parse(data);
        } catch (err) {
            if ((err as any)?.code === 'ENOENT') {
                this.preloadSizes = {};
            } else {
                throw err;
            }
        }
    }

    private static async savePreloadSizes(): Promise<void> {
        try {
            await writeFileAtomic(
                this.preloadSizesPath,
                JSON.stringify(this.preloadSizes, null, 4),
            );
        } catch (err) {
            error('Failed to flush preload sizes');
            error(err);
        }
    }

    private static async httpsGet(url: string): Promise<IncomingMessage> {
        return new Promise((resolve, reject) => {
            const req = https.get(url, (response) => {
                resolve(response);
            });

            req.on('error', (err) => {
                reject(err);
            });
        });
    }

    private static async ensureDirectoryExistence(filePath: string) {
        const dirName = path.dirname(filePath);
        await fs.promises.mkdir(dirName, { recursive: true });
    }

    private static async writeResponseToFile(
        res: IncomingMessage,
        filePath: string,
    ): Promise<void> {
        await this.ensureDirectoryExistence(filePath);

        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(filePath);
            res.pipe(writer);

            writer.on('finish', () => {
                resolve();
            });

            writer.on('error', (writeError) => {
                reject(writeError);
            });
        });
    }

    private static async fetchRemoteImage(
        imageName: string,
        localImagePath: string,
        width?: number,
    ) {
        const remoteUrl = await MediaWiki.resolveImageRedirect(
            imageName,
            width,
        );

        await MwnTokenBucket.acquireNTokens(width ? 1 : 3);
        const response = await this.httpsGet(remoteUrl);

        if (
            response.statusCode &&
            (response.statusCode < 200 || response.statusCode >= 300)
        ) {
            throw new Error();
        }

        await this.writeResponseToFile(response, localImagePath);
    }

    private static async getImageFromLocalCache(
        imageName: string,
        isPreload: boolean,
        width?: number,
    ): Promise<{ file: string; cached: boolean; isUnknownSize?: boolean }> {
        const fileNameWithoutExtension = path.basename(
            imageName,
            path.extname(imageName),
        );

        const imageDir = path.join(
            this.IMAGE_CACHE_DIR,
            MediaWiki.getImagePath(imageName),
            fileNameWithoutExtension,
        );

        let localImagePath: string = path.join(
            imageDir,
            `source${path.extname(imageName)}`,
        );

        try {
            if (width) {
                localImagePath = path.join(
                    imageDir,
                    `${width}${path.extname(imageName)}`,
                );

                await fs.promises.access(localImagePath);

                return { file: localImagePath, cached: true };
            }

            // Find the highest resolution version of the image in the cache
            const files = await fs.promises.readdir(imageDir);
            const regex = /^(\d+)/;
            let highestResVersion = '';
            let highestRes = width || 0;

            files.forEach((file) => {
                const match = file.match(regex);

                if (match && Number(match[1]) > highestRes) {
                    highestRes = Number(match[1]);
                    highestResVersion = path.join(imageDir, file);
                } else if (highestResVersion === '') {
                    highestResVersion = path.join(imageDir, file);
                }
            });

            if (highestResVersion) {
                await fs.promises.access(highestResVersion);

                return { file: highestResVersion, cached: true };
            }
        } catch (err) {
            // Cache miss, acquire image next
        }

        return {
            file: localImagePath,
            cached: false,
            isUnknownSize: isPreload,
        };
    }

    static async getImage(
        imageName: string,
        width?: number,
        preload: boolean = false,
    ): Promise<ResponseImage | ResponseRedirect> {
        let localImagePath: string;
        const imageKey = JSON.stringify({ imageName, width, preload });
        let isUnknownSize = false;

        if (CONFIG.MEDIAWIKI.USE_LOCAL_IMAGE_CACHE) {
            const localImage = await this.getImageFromLocalCache(
                imageName,
                preload,
                width,
            );

            if (localImage.cached) {
                return { file: localImage.file };
            }

            localImagePath = localImage.file;

            isUnknownSize =
                isUnknownSize || (localImage.isUnknownSize ?? false);
        } else {
            if (this.cachedResponses[imageKey]) {
                return this.cachedResponses[imageKey];
            }

            if (!width) {
                if (this.preloadSizes[imageName]) {
                    // eslint-disable-next-line no-param-reassign
                    width = this.preloadSizes[imageName];
                } else {
                    isUnknownSize = true;
                }
            }
        }

        const remoteUrl = await MediaWiki.resolveImageRedirect(
            imageName,
            width,
        );

        if (!CONFIG.MEDIAWIKI.USE_LOCAL_IMAGE_CACHE) {
            const result = { isUnknownSize, redirect: remoteUrl };

            if (!preload || !isUnknownSize) {
                this.cachedResponses[imageKey] = result;
            }

            return result;
        }

        localImagePath = localImagePath!;
        await this.fetchRemoteImage(imageName, localImagePath, width);

        return { isUnknownSize, file: localImagePath };
    }

    private static getLocalImagePath(imageName: string, width: number): string {
        const fileNameWithoutExtension = path.basename(
            imageName,
            path.extname(imageName),
        );

        const imageDir = path.join(
            this.IMAGE_CACHE_DIR,
            MediaWiki.getImagePath(imageName),
            fileNameWithoutExtension,
        );

        return path.join(imageDir, `${width}${path.extname(imageName)}`);
    }

    static async resizePreloadImage(
        imageName: string,
        width: number,
    ): Promise<any> {
        if (CONFIG.MEDIAWIKI.USE_LOCAL_IMAGE_CACHE) {
            const localImagePath = this.getLocalImagePath(imageName, width);

            try {
                await fs.promises.access(localImagePath);

                return;
            } catch (err) {
                // continue
            }

            await this.fetchRemoteImage(imageName, localImagePath, width);
        } else {
            this.preloadSizes[imageName] = Math.max(
                this.preloadSizes[imageName] ?? 0,
                width,
            );

            this.savePreloadSizes();
        }
    }
}

ImageCacheModel.loadPreloadSizes();
