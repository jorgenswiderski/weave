import { SharedUtils } from 'planner-types/src/models/utils';
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
}
