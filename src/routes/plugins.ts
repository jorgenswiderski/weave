import { InternJson } from '@jorgenswiderski/tomekeeper-shared/dist/models/intern-json/intern-json';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { warn } from '../models/logger';

export namespace FastifyPlugins {
    export const intern = fastifyPlugin(
        async (
            fastify: FastifyInstance,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            options,
        ) => {
            fastify.addHook(
                'onSend',
                async (
                    request: FastifyRequest,
                    reply: FastifyReply,
                    payload: string,
                ) => {
                    const header = reply.getHeader('Content-Type') as
                        | string
                        | undefined;

                    if (payload && header?.includes('application/json')) {
                        let modifiedJsonData = payload;

                        try {
                            const jsonData = JSON.parse(payload);

                            if (typeof jsonData === 'object') {
                                modifiedJsonData = JSON.stringify(
                                    InternJson.intern(jsonData),
                                );
                            }
                        } catch (err) {
                            warn(`Failed to parse object in intern plugin`);
                        }

                        return modifiedJsonData;
                    }

                    return payload;
                },
            );
        },
        {
            name: 'intern-plugin',
            fastify: '4.x',
        },
    );
}
