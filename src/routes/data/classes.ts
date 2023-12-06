// classes.ts
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getCharacterClassData } from '../../models/character-class/character-class';

export const classesRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const data = await getCharacterClassData();

        reply.send(data);
    });
};
