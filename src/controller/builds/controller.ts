import { BuildId } from '@jorgenswiderski/tomekeeper-shared/dist/types/builds';
import { FastifyReply } from 'fastify/types/reply';
import { FastifyRequest } from 'fastify';
import { Builds } from '../../models/builds/builds';
import {
    BuildDataTooLargeError,
    BuildNotFoundError,
} from '../../models/builds/types';
import { Utils } from '../../models/utils';
import { createBuildSchema } from './schema/create-build';

export namespace BuildsController {
    export const create = {
        schema: createBuildSchema,

        handler: async function buildsCreateHandler(
            request: FastifyRequest,
            reply: FastifyReply,
        ): Promise<void> {
            try {
                const { encodedData, buildVersion } = request.body as {
                    encodedData: string;
                    buildVersion: string;
                };

                const ip = Utils.getClientIp(request);

                const buildId = await Builds.create(
                    encodedData,
                    buildVersion,
                    ip,
                );

                reply.code(201).send({ buildId });
            } catch (err) {
                if (err instanceof BuildDataTooLargeError) {
                    reply.code(413).send({ error: err.message });

                    return;
                }

                throw err;
            }
        },
    };

    export const remove = {
        handler: async function buildsRemoveHandler(
            request: FastifyRequest,
            reply: FastifyReply,
        ): Promise<void> {
            const { id } = request.params as { id: BuildId };
            const ip = Utils.getClientIp(request);
            await Builds.delete(id, ip);
            reply.code(204).send();
        },
    };

    export const update = {
        handler: async function buildsUpdateHandler(
            request: FastifyRequest,
            reply: FastifyReply,
        ): Promise<void> {
            try {
                const { id } = request.params as { id: BuildId };
                const ip = Utils.getClientIp(request);

                const { encodedData, buildVersion } = request.body as {
                    encodedData: string;
                    buildVersion: string;
                };

                await Builds.update(id, encodedData, buildVersion, ip);
                reply.code(204).send();
            } catch (err) {
                if (err instanceof BuildDataTooLargeError) {
                    reply.code(413).send({ error: err.message });

                    return;
                }

                if (err instanceof BuildNotFoundError) {
                    reply.code(404).send({ error: err.message });

                    return;
                }

                throw err;
            }
        },
    };

    export const get = {
        handler: async function buildsGetHandler(
            request: FastifyRequest,
            reply: FastifyReply,
        ): Promise<void> {
            try {
                const { id } = request.params as { id: BuildId };
                const ip = Utils.getClientIp(request);
                const build = await Builds.get(id, ip);
                reply.send(build);
            } catch (err) {
                if (err instanceof BuildNotFoundError) {
                    reply.code(404).send({ error: err.message });

                    return;
                }

                throw err;
            }
        },
    };
}
