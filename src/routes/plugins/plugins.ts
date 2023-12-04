import { internJsonPlugin } from './object-intern';
import { LruCachePlugin } from './lru-cache';

export namespace FastifyPlugins {
    export const internJson = internJsonPlugin;
    export const lruCache = LruCachePlugin;
}
