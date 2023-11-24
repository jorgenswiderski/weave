import { CONFIG } from './config';
import { log } from './logger';

export class TokenBucket {
    private capacity: number;
    private tokens: number;
    private fillRate: number;
    private lastFillTime: number;
    private totalTokensRequested: number = 0;
    totalTokensGranted: number = 0;

    constructor(capacity: number, fillRate: number) {
        this.capacity = capacity;
        this.tokens = capacity;
        this.fillRate = fillRate;
        this.lastFillTime = Date.now();
    }

    refill(): void {
        const now = Date.now();
        const elapsedTime = (now - this.lastFillTime) / 1000;

        this.tokens = Math.min(
            this.capacity,
            this.tokens + elapsedTime * this.fillRate,
        );

        this.lastFillTime = now;
    }

    tokenUsage: Record<string, number> = {};

    protected static getParentFunctionName() {
        const err = new Error();
        const stack = err.stack!.split('\n');

        // Adjust the index based on where in the stack the parent function name appears
        // Index 2 usually gives the caller of getParentFunctionName
        // You might need to adjust this depending on the browser and the presence of strict mode
        return stack[3].trim();
    }

    public async acquireToken(): Promise<void> {
        if (CONFIG.MWN.TRACK_TOKEN_USAGE) {
            const fn = TokenBucket.getParentFunctionName();
            this.tokenUsage[fn] = (this.tokenUsage[fn] ?? 0) + 1;
        }

        this.totalTokensRequested += 1; // Increment the total requested tokens count

        return new Promise((resolve) => {
            const tryAcquire = () => {
                this.refill();

                if (this.tokens > 0) {
                    this.tokens -= 1;
                    this.totalTokensGranted += 1;
                    resolve();
                } else {
                    const delay = 1000 / this.fillRate;
                    setTimeout(tryAcquire, delay);
                }
            };

            tryAcquire();
        });
    }

    public async acquireNTokens(n: number): Promise<any[]> {
        return Promise.all(
            new Array(n).fill(null).map(() => this.acquireToken()),
        );
    }

    public getStatus() {
        const {
            tokens,
            capacity,
            totalTokensGranted: granted,
            totalTokensRequested: requested,
        } = this;

        return { tokens, capacity, granted, requested };
    }

    public logUsage(): void {
        log('Token usage:');

        Object.entries(this.tokenUsage)
            .sort((a, b) => b[1] - a[1])
            .forEach((a) => log(`${a[1]}\t${a[0]}`));
    }
}
