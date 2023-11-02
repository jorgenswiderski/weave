import { Request, Response } from 'express';
import assert from 'assert';
import { ImageCacheModel } from '../models/image-cache';
import { error, warn } from '../models/logger';
import { CONFIG } from '../models/config';

const failedRequests: {
    [imagePath: string]: { code: number; message: string };
} = {};

export class ImageClassController {
    static async getImage(req: Request, res: Response): Promise<void> {
        const { imageName } = req.params;

        const { w, p } = req.query as {
            w?: string;
            p?: string;
        };

        const preload: boolean = p === 'pre';
        const usePreloadSize: boolean = p === 'post';

        const width: number | undefined =
            !usePreloadSize && typeof w === 'string' && !Number.isNaN(Number(w))
                ? Number(w)
                : undefined;

        if (CONFIG.IS_DEV && !preload && !usePreloadSize && !width) {
            warn(
                `Warning: Serving image '${imageName}' with no specified width.`,
            );
        }

        if (failedRequests[imageName]) {
            const { code, message } = failedRequests[imageName];
            res.status(code).send(message);

            return;
        }

        try {
            const image = await ImageCacheModel.getImage(
                imageName,
                width,
                preload || usePreloadSize,
            );

            if ('file' in image) {
                res.sendFile(image.file);
            } else if ('redirect' in image) {
                if (preload) {
                    res.json({
                        remote: image.redirect,
                        isUnknownSize: image.isUnknownSize,
                    });
                } else {
                    res.redirect(302, image.redirect);
                }
            } else {
                throw new Error();
            }
        } catch (err) {
            // FIXME: Not all exceptions are 404!
            failedRequests[imageName] = {
                code: 404,
                message: 'Remote asset not found',
            };

            res.status(404).send('Remote asset not found');
        }
    }

    static async resizePreloadImage(
        req: Request,
        res: Response,
    ): Promise<void> {
        try {
            const { imageName } = req.params;
            const { width } = req.body;

            assert(typeof imageName === 'string');
            assert(typeof width === 'number' && width > 0);

            await ImageCacheModel.resizePreloadImage(imageName, width);

            res.status(200).send();
        } catch (err) {
            error(err);
            res.status(500).send();
        }
    }
}
