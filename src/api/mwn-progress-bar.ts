import { debug, log } from '../models/logger';
import { MwnTokenBucket } from './mwn';

export class MwnProgressBar {
    eventCount = 0;

    filling = false;

    render() {
        setInterval(() => {
            const { tokens, capacity, granted, requested } =
                MwnTokenBucket.getStatus();

            const pending = requested - granted;

            MwnTokenBucket.refill();

            const msg = `Loading wiki assets | Pending: ${pending} | Bucket: ${Math.floor(
                tokens,
            )} / ${capacity}`;

            if (capacity - tokens >= 5) {
                this.filling = true;
            }

            if (pending > 0 || this.filling) {
                if (this.eventCount % 5 === 0) {
                    log(msg);

                    if (capacity === tokens) {
                        this.filling = false;
                    }
                } else {
                    debug(msg);
                }
            }

            this.eventCount += 1;
        }, 1000);
    }
}
