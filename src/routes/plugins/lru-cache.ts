import { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

const maxSize = 100;

export const LruCachePlugin = fastifyPlugin(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (fastify: FastifyInstance, options) => {
        const cache = new Map();

        fastify.addHook('preHandler', async (request, reply) => {
            const route = `${request.method}:${request.url}`;
            const { query, params } = request;
            const key = JSON.stringify({ query, params });
            const routeCache = cache.get(route);

            if (routeCache?.has(key)) {
                reply.type('application/json');
                // reply.serializer((data) => data);
                reply.send(routeCache.get(key));
            }
        });

        fastify.addHook('onSend', async (request, reply, payload) => {
            const route = `${request.method}:${request.url}`;
            const { query, params } = request;
            const key = JSON.stringify({ query, params });
            const routeCache = cache.get(route) || new Map();

            if (!routeCache.has(key)) {
                routeCache.set(key, payload);

                if (routeCache.size >= maxSize) {
                    // Remove the least recently used item
                    routeCache.delete(routeCache.keys().next().value);
                }

                cache.set(route, routeCache);
            }

            return payload;
        });
    },
    {
        name: 'lruCachePlugin',
        fastify: '4.x',
    },
);
