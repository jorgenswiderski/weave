import { errorResponseSchema } from './error-response-schema';
import { imageSchema } from './image-schema';

export namespace Schema {
    export const errorResponse = errorResponseSchema;
    export const image = imageSchema;
}
