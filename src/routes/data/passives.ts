// passives.ts
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getPassiveDataFiltered } from '../../models/passive/passive';

export const passivesRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const passiveData = getPassiveDataFiltered();

        reply.send(passiveData);
    });
};
