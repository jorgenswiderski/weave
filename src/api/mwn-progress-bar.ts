import { CONFIG } from '../models/config';
import { log } from '../models/logger';
import { MwnTokenBucket } from './mwn';

export class MwnProgressBar {
    private static renderProgressBar(
        granted: number,
        total: number,
        width: number = 50,
    ) {
        // Calculate the number of characters to fill in
        const fillAmount = Math.round((granted / total) * width);

        // Generate the progress bar string
        const progressBar = `Loading wiki assets... [${'#'.repeat(
            fillAmount,
        )}${'-'.repeat(width - fillAmount)}]`;

        if (CONFIG.IS_DEV) {
            // Use a carriage return to move the cursor back to the beginning of the line
            process.stdout.write(`\r${progressBar} ${granted}/${total}`);
        } else if (granted === total || granted % 20 === 0) {
            // Don't use carriage return on remote environment, just throttle a bit instead.
            log(`${progressBar} ${granted}/${total}`);
        }
    }

    progress?: { granted: number; total: number };

    render() {
        setInterval(() => {
            const progress = MwnTokenBucket.getProgress();

            if (JSON.stringify(progress) !== JSON.stringify(this.progress)) {
                this.progress = progress;

                MwnProgressBar.renderProgressBar(
                    progress.granted,
                    progress.total,
                );
            }
        }, 100);
    }
}
