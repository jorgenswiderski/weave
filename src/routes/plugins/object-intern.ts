import { InternJson } from '@jorgenswiderski/tomekeeper-shared/dist/models/intern-json/intern-json';
import { warn } from 'console';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

export const internJsonPlugin = fastifyPlugin(
    async (fastify: FastifyInstance) => {
        fastify.addHook(
            'onSend',
            async (
                request: FastifyRequest,
                reply: FastifyReply,
                payload?: string,
            ) => {
                if (!payload) {
                    return payload;
                }

                if (reply.getHeader('lru-cached-response')) {
                    return payload;
                }

                const header = reply.getHeader('Content-Type') as
                    | string
                    | undefined;

                if (header?.includes('application/json')) {
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
        name: 'object-intern-plugin',
    },
);
