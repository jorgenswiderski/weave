// races.ts
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getCharacterRaceData } from '../../models/character-feature/features/character-race';

export const racesRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const data = await getCharacterRaceData();

        reply.send(data);
    });
};
