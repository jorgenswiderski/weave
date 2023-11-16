import { SharedUtils } from '@jorgenswiderski/tomekeeper-shared/dist/models/utils';
import { Request } from 'express';

export class Utils extends SharedUtils {
    static memoizeWithExpiration<T extends (...args: any[]) => any>(
        ttl: number,
        fn: T,
    ): T {
        const cache: { [key: string]: { value: any; timestamp: number } } = {};

        return function memoizedFn(...args: any[]): any {
            const key = JSON.stringify(args);
            const now = Date.now();

            if (cache[key] && now - cache[key].timestamp < ttl) {
                return cache[key].value;
            }

            const result = fn(...args);
            cache[key] = { value: result, timestamp: now };

            return result;
        } as unknown as T;
    }

    static resolvedPromise = new Promise<void>((resolve) => {
        resolve();
    });

    static isNonEmptyArray(a?: any[] | null): boolean {
        return Array.isArray(a) && a.length > 0;
    }

    static getClientIp(req: Request): string {
        // The X-Forwarded-For header can contain a list of IP addresses.
        // The first one in the list should be the original client's IP address.
        const forwarded = req.headers['x-forwarded-for'];

        const str =
            typeof forwarded === 'string'
                ? forwarded.split(',')[0].trim()
                : req.ip;

        // If the IP address is an IPv6-mapped IPv4 address, convert it to IPv4 format
        if (str.includes('::ffff:')) {
            return str.split(':').pop()!;
        }

        return str;
    }

    // Linear congruential generator (LCG) that generates a number between 0 and 1 based on the given seed
    static randomSeeded(seed: number): number {
        // LCG parameters
        const a = 1664525;
        const c = 1013904223;
        const m = 2 ** 32;

        // Generate the next seed and return a pseudo-random number between 0 and 1
        const nextSeed = (a * seed + c) % m;

        return nextSeed / m;
    }

    static stringToTitleCase(str: string): string {
        return str.toLowerCase().replace(/(?:^|\s)\S/g, function titlecase(a) {
            return a.toUpperCase();
        });
    }

    static async asyncFilter<T>(
        arr: T[],
        predicate: (item: T) => Promise<boolean>,
    ): Promise<T[]> {
        const results = await Promise.all(arr.map(predicate));

        return arr.filter((_v, index) => results[index]);
    }
}
