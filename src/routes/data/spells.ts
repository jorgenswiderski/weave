// spells.ts
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getSpellDataFiltered } from '../../models/action/spell';

export const spellsRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const spellData = await getSpellDataFiltered();

        reply.send(spellData);
    });
};
