// backgrounds.ts
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getCharacterBackgroundData } from '../../models/character-feature/features/character-background';

export const backgroundsRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/:id', {
        schema: {
            params: {
                id: { type: 'number' },
            },
        },
        handler: async function backgroundIdHandler(
            request: FastifyRequest,
            reply: FastifyReply,
        ): Promise<void> {
            const { id } = request.params as { id: number };

            const data = await getCharacterBackgroundData();

            const background = data.find(
                (datum) => datum.id && id === datum.id,
            );

            if (!background) {
                reply
                    .code(404)
                    .send({ error: `No background with that ID exists` });

                return;
            }

            reply.send(background);
        },
    });

    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const data = await getCharacterBackgroundData();

        reply.send(data);
    });
};
