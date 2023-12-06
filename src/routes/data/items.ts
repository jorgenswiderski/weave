// items.ts
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import {
    getEquipmentItemData,
    getEquipmentItemInfoById,
} from '../../models/equipment/equipment';

export const itemsRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/equipment', {
        schema: {
            params: {
                types: { type: 'string' },
            },
        },

        handler: async function equipmentHandler(
            request: FastifyRequest,
            reply: FastifyReply,
        ) {
            const { types: typesParam } = request.query as { types?: string };
            let types: number[] | undefined;

            if (typesParam) {
                types = typesParam
                    .split(',')
                    .map((value) => parseInt(value, 10));
            }

            const itemData = await getEquipmentItemData(types);

            reply.send(itemData);
        },
    });

    fastify.get('/equipment/:id', {
        schema: {
            params: {
                id: { type: 'number' },
            },
        },

        handler: async function itemsIdHandler(
            request: FastifyRequest,
            reply: FastifyReply,
        ) {
            const { id } = request.params as { id: number };
            const itemData = await getEquipmentItemInfoById();

            reply.send(itemData.get(id));
        },
    });
};
