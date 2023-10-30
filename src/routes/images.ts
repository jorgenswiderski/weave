import express, { Request, Response, Router } from 'express';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { error, warn } from '../models/logger';
import { MediaWiki } from '../models/media-wiki';
import { MwnTokenBucket } from '../api/mwn';
import { CONFIG } from '../models/config';

const rootDir = path.dirname(require.main!.filename);
const IMAGE_CACHE_DIR = path.join(rootDir, 'cache');
const failedRequests: {
    [imagePath: string]: { code: number; message: string };
} = {};
const resolvedImageUrls: { [imageKey: string]: string } = {};

const ensureDirectoryExistence = async (filePath: string) => {
    const dirName = path.dirname(filePath);
    await fs.promises.mkdir(dirName, { recursive: true });
};

export const router: Router = express.Router();

router.get('/:imageName', async (req: Request, res: Response) => {
    const { imageName } = req.params;
    const { width: widthRaw, preload } = req.query as {
        width?: string;
        preload?: string;
    };

    // Convert width to number if it's a valid string representation of a number
    const width =
        typeof widthRaw === 'string' && !Number.isNaN(Number(widthRaw))
            ? Number(widthRaw)
            : undefined;

    if (CONFIG.IS_DEV && !preload && !width) {
        warn(`Warning: Serving image '${imageName}' with no specified width.`);
    }

    if (failedRequests[imageName]) {
        res.status(failedRequests[imageName].code).send(
            failedRequests[imageName].message,
        );

        return;
    }

    let localImagePath: string;
    const imageKey = JSON.stringify({ imageName, width });

    if (CONFIG.MEDIAWIKI.USE_LOCAL_IMAGE_CACHE) {
        const fileNameWithoutExtension = path.basename(
            imageName,
            path.extname(imageName),
        );

        const imageDir = path.join(
            IMAGE_CACHE_DIR,
            MediaWiki.getImagePath(imageName),
            fileNameWithoutExtension,
        );

        try {
            if (width) {
                localImagePath = path.join(
                    imageDir,
                    `${width}${path.extname(imageName)}`,
                );

                await fs.promises.access(localImagePath);
                res.sendFile(localImagePath);

                return;
            }

            localImagePath = path.join(
                imageDir,
                `source${path.extname(imageName)}`,
            );

            // Find the highest resolution version of the image in the cache
            const files = await fs.promises.readdir(imageDir);
            const regex = /^(\d+)/;
            let highestResVersion = '';
            let highestRes = width || 0;

            // eslint-disable-next-line no-restricted-syntax
            for (const file of files) {
                const match = file.match(regex);

                if (match && Number(match[1]) > highestRes) {
                    highestRes = Number(match[1]);
                    highestResVersion = path.join(imageDir, file);
                } else if (highestResVersion === '') {
                    highestResVersion = path.join(imageDir, file);
                }
            }

            if (highestResVersion) {
                await fs.promises.access(highestResVersion);
                res.sendFile(highestResVersion);

                return;
            }
        } catch (err) {
            // Cache miss, acquire image next
        }

        // warn(`missed cache for ${imageName}`);

        if (preload) {
            res.setHeader('Access-Control-Expose-Headers', 'X-Unknown-Size');
            res.setHeader('X-Unknown-Size', 'true');
        }
    } else if (resolvedImageUrls[imageKey]) {
        res.redirect(resolvedImageUrls[imageKey]);

        return;
    }

    try {
        const remoteUrl = await MediaWiki.resolveImageRedirect(
            imageName,
            width,
        );
        resolvedImageUrls[imageKey] = remoteUrl;

        if (!CONFIG.MEDIAWIKI.USE_LOCAL_IMAGE_CACHE) {
            res.redirect(remoteUrl);

            return;
        }

        await MwnTokenBucket.acquireNTokens(width ? 1 : 3);

        https
            .get(remoteUrl, async (response) => {
                if (
                    response.statusCode &&
                    (response.statusCode < 200 || response.statusCode >= 300)
                ) {
                    if (
                        response.statusCode >= 400 &&
                        response.statusCode < 500
                    ) {
                        failedRequests[imageName] = {
                            code: response.statusCode,
                            message:
                                response.statusMessage ?? 'Unspecified error',
                        };
                    }

                    res.status(response.statusCode).send(
                        response.statusMessage ?? 'Error fetching the image',
                    );

                    return;
                }

                // Ensure all subdirectories exist before writing
                await ensureDirectoryExistence(localImagePath);

                const writer = fs.createWriteStream(localImagePath);
                response.pipe(writer);

                writer.on('finish', () => {
                    res.sendFile(localImagePath);
                });

                writer.on('error', (writeError) => {
                    error(writeError);
                    res.status(500).send('Error saving the image');
                });
            })
            .on('error', (err) => {
                // Handle other types of errors (e.g. network issues)
                error(err);
                res.status(500).send('Failed to retrieve the image');
            });
    } catch (err) {
        failedRequests[imageName] = {
            code: 404,
            message: 'Remote asset not found',
        };

        res.status(404).send('Remote asset not found');
    }
});

router.post('/updateSize/:imageName', async (req: Request, res: Response) => {
    const { imageName } = req.params;
    const { width } = req.body;

    if (!width) {
        res.status(400).send('Width is required');

        return;
    }

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

    const remoteUrl = await MediaWiki.resolveImageRedirect(imageName, width);
    await MwnTokenBucket.acquireToken();

    https
        .get(remoteUrl, async (response) => {
            if (
                response.statusCode &&
                (response.statusCode < 200 || response.statusCode >= 300)
            ) {
                throw new Error();
            }

            // Ensure all subdirectories exist before writing
            await ensureDirectoryExistence(localImagePath);
            const writer = fs.createWriteStream(localImagePath);
            response.pipe(writer);

            writer.on('finish', () => {
                res.status(200).send();
            });

            writer.on('error', (writeError) => {
                error(writeError);
                res.status(500).send('Error saving the image');
            });
        })
        .on('error', (err) => {
            // Handle other types of errors (e.g. network issues)
            error(err);
            res.status(500).send('Failed to retrieve the image');
        });
});

export const imageRouter = router;
