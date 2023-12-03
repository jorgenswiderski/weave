// routes/builds.ts
import { FastifyPluginAsync } from 'fastify';
import { BuildsController } from '../controller/builds/controller';

export const buildsRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.post('/create', BuildsController.create);
    fastify.delete('/delete/:id', BuildsController.remove);
    fastify.put('/update/:id', BuildsController.update);
    fastify.get('/get/:id', BuildsController.get);
};
