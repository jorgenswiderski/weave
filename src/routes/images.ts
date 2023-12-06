// routes/images.ts
import { FastifyPluginAsync } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { ImageController } from '../controller/image-cache/controller';

export const imageRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.register(fastifyStatic, {
        root: path.join(__dirname, '../cache'),
    });

    fastify.get('/:imageName', ImageController.get);
    fastify.post('/resize/:imageName', ImageController.resize);
};
