export const errorResponseSchema = {
    type: 'object',
    properties: { error: { type: 'string' } },
    required: ['error'],
} as const;
