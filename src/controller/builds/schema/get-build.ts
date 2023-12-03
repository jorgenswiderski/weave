import { Schema } from '../../../schema';

export const getBuildSchema = {
    params: {
        type: 'object',
        properties: {
            id: { type: 'string' },
        },
        required: ['id'],
    },
    response: {
        200: {
            type: 'object',
            properties: {
                encoded: { type: 'string' },
                version: { type: 'string' },
                id: { type: 'string' },
                mayEdit: { type: 'boolean' },
            },
            required: ['encoded', 'version', 'id'],
        },
        404: Schema.errorResponse,
    },
} as const;
