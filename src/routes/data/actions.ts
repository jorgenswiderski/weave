// actions.ts
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getActionDataFiltered } from '../../models/action/init';

export const actionsRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const actionData = await getActionDataFiltered();

        reply.send(actionData);
    });
};
