// controller/image-cache/index.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { ImageCacheModel } from '../../models/image-cache/image-cache';
import { error, warn } from '../../models/logger';
import { CONFIG } from '../../models/config';
import { RemoteImageError } from '../../models/image-cache/types';
import { resizePreloadImageSchema } from './schema/resize-preload-image';
import { getImageSchema } from './schema/get-image';

const failedRequests: {
    [imagePath: string]: { code: number; message: string };
} = {};

export namespace ImageController {
    export const get = {
        schema: getImageSchema,

        handler: async function imageGetHandler(
            request: FastifyRequest,
            reply: FastifyReply,
        ): Promise<void> {
            const { imageName } = request.params as { imageName: string };

            const { w, p } = request.query as {
                w?: string;
                p?: string;
            };

            const preload: boolean = p === 'pre';

            const width: number | undefined =
                typeof w === 'string' && !Number.isNaN(Number(w))
                    ? Number(w)
                    : undefined;

            if (CONFIG.IS_DEV && !preload && !width) {
                warn(
                    `Warning: Serving image '${imageName}' with no specified width.`,
                );
            }

            if (failedRequests[imageName]) {
                const { code, message } = failedRequests[imageName];
                reply.code(code).send(message);

                return;
            }

            try {
                const image = await ImageCacheModel.getImage(
                    imageName,
                    width,
                    preload,
                );

                if ('file' in image) {
                    // FIXME
                    reply.sendFile(image.file);
                } else if ('redirect' in image) {
                    if (preload) {
                        reply.send({
                            remote: image.redirect,
                            isUnknownSize: image.isUnknownSize,
                        });
                    } else {
                        reply.redirect(302, image.redirect);
                    }
                } else {
                    throw new Error();
                }
            } catch (err) {
                if (err instanceof RemoteImageError) {
                    if (err.statusCode >= 400 && err.statusCode < 500) {
                        failedRequests[imageName] = {
                            code: err.statusCode,
                            message: 'Remote asset not found',
                        };
                    }

                    warn(
                        `Failed image request: ${imageName} (${err.statusCode})`,
                    );

                    reply
                        .code(err.statusCode)
                        .send('Failed to acquire remote asset');

                    return;
                }

                error(err);
                reply.code(500).send('Internal server error');
            }
        },
    };

    export const resize = {
        schema: resizePreloadImageSchema,

        handler: async function imageResizeHandler(
            request: FastifyRequest,
            reply: FastifyReply,
        ): Promise<void> {
            try {
                const { imageName } = request.params as { imageName: string };
                const { width } = request.body as { width: number };

                await ImageCacheModel.resizePreloadImage(imageName, width);

                reply.code(200).send();
            } catch (err) {
                error(err);
                reply.code(500).send();
            }
        },
    };
}
