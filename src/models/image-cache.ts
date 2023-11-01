import path from 'path';
import fs from 'fs';
import https from 'https';
import { IncomingMessage } from 'http';
import { MediaWiki } from './media-wiki';
import { MwnTokenBucket } from '../api/mwn';
import { CONFIG } from './config';

const rootDir = path.dirname(require.main!.filename);
const IMAGE_CACHE_DIR = path.join(rootDir, 'cache');
const cachedResponses: { [imageKey: string]: ResponseRedirect } = {};

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
            IMAGE_CACHE_DIR,
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
        const imageKey = JSON.stringify({ imageName, width });
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
        } else if (cachedResponses[imageKey]) {
            return cachedResponses[imageKey];
        }

        const remoteUrl = await MediaWiki.resolveImageRedirect(
            imageName,
            width,
        );

        if (!CONFIG.MEDIAWIKI.USE_LOCAL_IMAGE_CACHE) {
            const result = { isUnknownSize, redirect: remoteUrl };
            cachedResponses[imageKey] = result;

            return result;
        }

        localImagePath = localImagePath!;
        await this.fetchRemoteImage(imageName, localImagePath, width);

        return { isUnknownSize, file: localImagePath };
    }

    static async resizePreloadImage(
        imageName: string,
        width: number,
    ): Promise<any> {
        const fileNameWithoutExtension = path.basename(
            imageName,
            path.extname(imageName),
        );

        const imageDir = path.join(
            IMAGE_CACHE_DIR,
            MediaWiki.getImagePath(imageName),
            fileNameWithoutExtension,
        );

        const localImagePath = path.join(
            imageDir,
            `${width}${path.extname(imageName)}`,
        );

        try {
            await fs.promises.access(localImagePath);

            return;
        } catch (err) {
            // continue
        }

        await this.fetchRemoteImage(imageName, localImagePath, width);
    }
}
