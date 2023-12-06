import { Schema } from '../../../schema';

export const createBuildSchema = {
    body: {
        type: 'object',
        properties: {
            encodedData: { type: 'string' },
            buildVersion: { type: 'string' },
        },
        required: ['encodedData', 'buildVersion'],
    },
    response: {
        201: {
            type: 'object',
            properties: {
                buildId: { type: 'string' },
            },
            required: ['buildId'],
        },
        413: Schema.errorResponse,
    },
} as const;
