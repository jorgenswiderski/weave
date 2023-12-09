import path from 'path';
import fs from 'fs';
import https from 'https';
import { IncomingMessage } from 'http';
import writeFileAtomic from 'write-file-atomic';
import { MediaWiki } from '../media-wiki/media-wiki';
import { MwnTokenBucket } from '../../api/mwn';
import { CONFIG } from '../config';
import { debug, error, warn } from '../logger';
import { RemoteImageError } from './types';

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

    static preloadSizesFile = 'preload-sizes.json';
    static preloadSizes: { [imageName: string]: number } = {};

    static async loadFileFromCache(
        fileName: string,
    ): Promise<Record<string, any>> {
        try {
            const filePath = path.join(this.IMAGE_CACHE_DIR, fileName);
            await this.ensureDirectoryExistence(filePath);
            const data = await fs.promises.readFile(filePath, 'utf-8');

            return JSON.parse(data);
        } catch (err) {
            if ((err as any)?.code === 'ENOENT') {
                return {};
            }

            throw err;
        }
    }

    private static async flushPreloadSizes(): Promise<void> {
        try {
            await writeFileAtomic(
                path.join(this.IMAGE_CACHE_DIR, this.preloadSizesFile),
                JSON.stringify(this.preloadSizes, null, 4),
            );
        } catch (err) {
            warn('Failed to flush preload sizes:');
            warn(err);
        }
    }

    static assetMapFile = 'remote-asset-map.json';
    static assetMap: { [imageKey: string]: string } = {};
    static assetCacheTimeFile = 'remote-asset-cache-time.json';
    static assetCacheTime: { [remoteImageUrl: string]: number } = {};

    private static async flushAssetMap(): Promise<void> {
        try {
            await writeFileAtomic(
                path.join(this.IMAGE_CACHE_DIR, this.assetMapFile),
                JSON.stringify(this.assetMap, null, 4),
            );

            await writeFileAtomic(
                path.join(this.IMAGE_CACHE_DIR, this.assetCacheTimeFile),
                JSON.stringify(this.assetCacheTime, null, 4),
            );
        } catch (err) {
            warn('Failed to flush asset map:');
            warn(err);
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

    private static async resolveImageRedirect(
        imageName: string,
        width?: number,
    ): Promise<string> {
        const key = JSON.stringify({ imageName, width });

        if (this.assetMap[key]) {
            const remoteUrl = this.assetMap[key];
            const cacheTime = this.assetCacheTime[remoteUrl];

            if (cacheTime) {
                const age = Date.now() - cacheTime;

                if (age < CONFIG.MEDIAWIKI.IMAGE_CACHE_DURATION) {
                    if (age > CONFIG.MEDIAWIKI.IMAGE_CACHE_REFRESH_TIME) {
                        MediaWiki.resolveImageRedirect(imageName, width)
                            .catch(error)
                            .then(() => {
                                debug(
                                    `Refreshed remote image cache for '${imageName}'`,
                                );

                                this.assetCacheTime[remoteUrl] = Date.now();
                                this.flushAssetMap();
                            });
                    }

                    return this.assetMap[key];
                }
            }
        }

        const remoteUrl = await MediaWiki.resolveImageRedirect(
            imageName,
            width,
        );

        this.assetCacheTime[remoteUrl] = Date.now();
        this.assetMap[key] = remoteUrl;
        this.flushAssetMap();

        return remoteUrl;
    }

    private static async fetchRemoteImage(
        imageName: string,
        localImagePath: string,
        width?: number,
    ) {
        const remoteUrl = await this.resolveImageRedirect(imageName, width);

        await MwnTokenBucket.acquireNTokens(width ? 1 : 3);
        const response = await this.httpsGet(remoteUrl);

        if (
            response.statusCode &&
            (response.statusCode < 200 || response.statusCode >= 300)
        ) {
            throw new RemoteImageError(response.statusCode);
        }

        await this.writeResponseToFile(response, localImagePath);
    }

    private static getRelativePath(absolutePath: string): {
        relative: string;
        absolute: string;
    } {
        return {
            absolute: absolutePath,
            relative: absolutePath.split(`${this.IMAGE_CACHE_DIR}\\`)[1],
        };
    }

    private static async getImageFromLocalCache(
        imageName: string,
        isPreload: boolean,
        width?: number,
    ): Promise<{
        file: { relative: string; absolute: string };
        cached: boolean;
        isUnknownSize?: boolean;
    }> {
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

                return {
                    file: this.getRelativePath(localImagePath),
                    cached: true,
                };
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

                return {
                    file: this.getRelativePath(highestResVersion),
                    cached: true,
                };
            }
        } catch (err) {
            // Cache miss, acquire image next
        }

        return {
            file: this.getRelativePath(localImagePath),
            cached: false,
            isUnknownSize: isPreload,
        };
    }

    static async getImage(
        imageName: string,
        width?: number,
        preload: boolean = false,
    ): Promise<ResponseImage | ResponseRedirect> {
        let localImagePath: { relative: string; absolute: string };
        const imageKey = JSON.stringify({ imageName, width, preload });
        let isUnknownSize = false;

        if (CONFIG.MEDIAWIKI.USE_LOCAL_IMAGE_CACHE) {
            const localImage = await this.getImageFromLocalCache(
                imageName,
                preload,
                width,
            );

            if (localImage.cached) {
                return { file: localImage.file.relative };
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

        if (!CONFIG.MEDIAWIKI.USE_LOCAL_IMAGE_CACHE) {
            const remoteUrl = await this.resolveImageRedirect(imageName, width);

            const result = { isUnknownSize, redirect: remoteUrl };

            if (!preload || !isUnknownSize) {
                this.cachedResponses[imageKey] = result;
            }

            return result;
        }

        localImagePath = localImagePath!;

        await this.fetchRemoteImage(imageName, localImagePath.absolute, width);

        return { isUnknownSize, file: localImagePath.relative };
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

            this.flushPreloadSizes();
        }
    }
}

(async () => {
    ImageCacheModel.preloadSizes = await ImageCacheModel.loadFileFromCache(
        ImageCacheModel.preloadSizesFile,
    );

    ImageCacheModel.assetMap = await ImageCacheModel.loadFileFromCache(
        ImageCacheModel.assetMapFile,
    );

    ImageCacheModel.assetCacheTime = await ImageCacheModel.loadFileFromCache(
        ImageCacheModel.assetCacheTimeFile,
    );
})();
