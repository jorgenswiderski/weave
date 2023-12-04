import { FastifySchema } from 'fastify';
import { Schema } from '../../../schema';

export const resizePreloadImageSchema: FastifySchema = {
    body: {
        type: 'object',
        properties: {
            width: { type: 'number' },
        },
        required: ['width'],
    },
    response: {
        200: {
            type: 'null',
        },
        500: Schema.errorResponse,
    },
} as const;
