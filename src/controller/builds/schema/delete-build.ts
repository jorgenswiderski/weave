import { Schema } from '../../../schema';

export const deleteBuildSchema = {
    params: {
        type: 'object',
        properties: {
            id: { type: 'string' },
        },
        required: ['id'],
    },
    response: {
        ...Schema.errorResponse,
        204: {
            type: 'null',
        },
    },
} as const;
