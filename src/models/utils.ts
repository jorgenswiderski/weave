export class Utils {
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
}
