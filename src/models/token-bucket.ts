export class TokenBucket {
    private capacity: number;
    private tokens: number;
    private fillRate: number;
    private lastFillTime: number;
    lifetimeTokens: number = 0;

    constructor(capacity: number, fillRate: number) {
        this.capacity = capacity; // The maximum number of tokens the bucket can hold
        this.tokens = capacity; // The current number of tokens in the bucket
        this.fillRate = fillRate; // The rate at which the bucket fills in tokens/second
        this.lastFillTime = Date.now(); // The last time the bucket was filled
    }

    // Refill tokens based on how much time has passed since the last refill
    private refill(): void {
        const now = Date.now();
        const elapsedTime = (now - this.lastFillTime) / 1000; // Convert to seconds

        this.tokens = Math.min(
            this.capacity,
            this.tokens + elapsedTime * this.fillRate,
        );

        this.lastFillTime = now;
    }

    public async acquireToken(): Promise<void> {
        return new Promise((resolve) => {
            const tryAcquire = () => {
                this.refill(); // Refill the bucket

                if (this.tokens > 0) {
                    this.tokens -= 1;
                    this.lifetimeTokens += 1;
                    // log(this.lifetimeTokens);
                    resolve();
                } else {
                    // If no tokens are available, check again after a delay
                    const delay = 1000 / this.fillRate; // Time until the next token is available
                    setTimeout(tryAcquire, delay);
                }
            };

            tryAcquire();
        });
    }
}
