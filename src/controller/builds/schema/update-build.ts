import { Schema } from '../../../schema';

export const updateBuildSchema = {
    params: {
        type: 'object',
        properties: {
            id: { type: 'string' },
        },
        required: ['id'],
    },
    body: {
        type: 'object',
        properties: {
            encodedData: { type: 'string' },
            buildVersion: { type: 'string' },
        },
        required: ['encodedData', 'buildVersion'],
    },
    response: {
        204: {
            type: 'null',
        },
        404: Schema.errorResponse,
        413: Schema.errorResponse,
    },
} as const;
