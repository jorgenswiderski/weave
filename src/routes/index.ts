// routes/index.ts
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fastifyResponseValidation from '@fastify/response-validation';
import { imageRoutes } from './images';
// import { dataRoutes } from './data';
import { debug, error } from '../models/logger';
import { CONFIG } from '../models/config';
import { buildsRoutes } from './builds';
import { dataRoutes } from './data';

export const apiRoutes: FastifyPluginAsync = async (
    fastify: FastifyInstance,
) => {
    if (CONFIG.IS_DEV) {
        // Only enable in dev environment due to overhead
        fastify.register(fastifyResponseValidation);
    }

    fastify.register(dataRoutes, { prefix: '/data' });
    fastify.register(imageRoutes, { prefix: '/images' });
    fastify.register(buildsRoutes, { prefix: '/builds' });

    fastify.setErrorHandler((err, req, reply) => {
        error('Error handling middleware invoked');
        debug(reply);
        debug(err);

        error(err.stack);
        reply.status(500).send('Internal server error');
    });
};
