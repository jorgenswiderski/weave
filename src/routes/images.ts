import express, { Request, Response, Router } from 'express';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { error } from '../models/logger';
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

    if (fs.existsSync(dirName)) {
        return;
    }

    await ensureDirectoryExistence(dirName);
    await fs.promises.mkdir(dirName);
};

export const router: Router = express.Router();

router.get('/:imageName', async (req: Request, res: Response) => {
    const { imageName } = req.params;
    const { width: widthRaw } = req.query;

    // Convert width to number if it's a valid string representation of a number
    const width =
        typeof widthRaw === 'string' && !Number.isNaN(Number(widthRaw))
            ? Number(widthRaw)
            : undefined;

    if (failedRequests[imageName]) {
        res.status(failedRequests[imageName].code).send(
            failedRequests[imageName].message,
        );

        return;
    }

    let localImagePath: string;
    const imageKey = JSON.stringify({ imageName, width });

    if (CONFIG.MEDIAWIKI.USE_LOCAL_IMAGE_CACHE) {
        // Proceed with caching mechanism
        localImagePath = path.join(
            IMAGE_CACHE_DIR,
            MediaWiki.getImagePath(`${imageName}${width ? `-${width}px` : ''}`),
        );

        try {
            await fs.promises.access(localImagePath);
            res.sendFile(localImagePath);

            return;
        } catch (err) {
            // File does not exist, we'll fetch from remote next.
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

        await MwnTokenBucket.acquireNTokens(3);

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
        res.status(404).send('Remote asset not found');
    }
});

export const imageRouter = router;
