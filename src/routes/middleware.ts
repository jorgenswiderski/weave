import { NextFunction, Request, Response } from 'express';
import { InternJson } from '@jorgenswiderski/tomekeeper-shared/dist/models/intern-json/intern-json';
import { debug } from '../models/logger';

export class Middleware {
    static intern(req: Request, res: Response, next: NextFunction): void {
        // Hook res.json function
        const originalJson = res.json;

        res.json = function internMiddleware(jsonData: any) {
            let modifiedJsonData = jsonData;

            if (typeof jsonData === 'object') {
                const t = Date.now();
                modifiedJsonData = InternJson.intern(jsonData);
                debug(`Internment took ${Date.now() - t}ms.`);
            }

            return originalJson.call(this, modifiedJsonData);
        };

        next();
    }

    private static maxSize: number = 100;
    private static cache: Record<string, Map<string, any>> = {};

    static lruCache(req: Request, res: Response, next: NextFunction): void {
        const route = `${req.method}:${req.originalUrl}`;
        Middleware.cache[route] = Middleware.cache[route] ?? new Map();
        const cache = Middleware.cache[route];
        const key = JSON.stringify(req.params);

        if (cache.has(key)) {
            debug('Cache hit');
            const body = cache.get(key)!;
            res.type('application/json');
            res.send(body);
        } else {
            debug('Cache miss');
            const originalJson = res.json.bind(res);

            res.json = function lruCacheMiddleware(body: any): Response {
                cache.set(key, body);
                Middleware.cleanCache(cache);

                return originalJson(body);
            };

            next();
        }
    }

    private static cleanCache(cache: Map<string, any>): void {
        if (cache.size >= Middleware.maxSize) {
            debug('Express LRU Cache middleware cache reached max size');
            cache.delete(cache.keys().next().value); // Remove the least recently used item
        }
    }
}
