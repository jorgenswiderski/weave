import { SharedUtils } from 'planner-types/src/models/utils';

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
}
