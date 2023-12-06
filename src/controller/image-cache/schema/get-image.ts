import { CONFIG } from '../../../models/config';
import { Schema } from '../../../schema';

export const getImageSchema = {
    params: {
        type: 'object',
        properties: {
            imageName: { type: 'string' },
        },
        required: ['imageName'],
    },
    querystring: {
        type: 'object',
        properties: {
            w: { type: 'string', nullable: true },
            p: { type: 'string', nullable: true },
        },
    },
    response: {
        200: CONFIG.MEDIAWIKI.USE_LOCAL_IMAGE_CACHE
            ? Schema.image
            : {
                  type: 'object',
                  properties: {
                      remote: { type: 'string' },
                      isUnknownSize: { type: 'boolean', nullable: true },
                  },
              },
        302: {
            type: 'null',
        },
        '4xx': Schema.errorResponse,
        500: Schema.errorResponse,
    },
} as const;
