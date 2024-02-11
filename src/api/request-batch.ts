import { ApiParams, ApiResponse, Mwn } from 'mwn';
import { TokenBucket } from '../models/token-bucket';
import { CONFIG } from '../models/config';

export type ApiParam =
    | string
    | string[]
    | boolean
    | number
    | number[]
    | Date
    | File
    | {
          stream: NodeJS.ReadableStream;
          name: string;
      };

export class RequestBatch {
    output?: Promise<ApiResponse>;
    timeout?: NodeJS.Timeout;

    private static batchingInterval: number =
        CONFIG.MWN.REQUEST_BATCHING_WINDOW_IN_MILLIS;
    private resolve?: (value: ApiResponse | PromiseLike<ApiResponse>) => void;
    private inputs: ApiParam[] = [];

    constructor(
        public parent: Record<string, RequestBatch>,
        public bot: Mwn,
        public bucket: TokenBucket,
        public queryKey: string,
        public batchAxis: keyof ApiParams,
        public params: ApiParams,
    ) {}

    private async executeBatch(): Promise<void> {
        const { params, batchAxis, resolve, inputs, timeout } = this;

        this.resolve = undefined;
        this.output = undefined;
        clearTimeout(timeout);
        this.timeout = undefined;
        this.inputs = [];

        if (!inputs || inputs.length === 0) {
            throw new Error('executed api batch with no contents');
        }

        if (!resolve) {
            throw new Error('no resolve');
        }

        // debug(
        //     `Executing "${batchAxis}" batch of ${
        //         inputs.length
        //     } requests (params=${JSON.stringify(params)})\n  ${JSON.stringify(
        //         inputs,
        //     ).slice(0, 70)}`,
        // );

        await this.bucket.acquireToken();

        let data: Record<string, any> | undefined;
        let continueData: { continue?: string } | undefined = {};

        while (continueData) {
            // eslint-disable-next-line no-await-in-loop
            await this.bucket.acquireToken();

            const { continue: ignored, ...continueProps } = continueData;

            // eslint-disable-next-line no-await-in-loop
            const response = await this.bot.query({
                ...(params as any),
                [batchAxis]: inputs,
                ...continueProps,
            });

            if (!data) {
                data = response;
            } else {
                const { pages } = data.query;

                // Update the initial response's pages with the new page properties
                response.query!.pages.forEach((page: Record<string, any>) => {
                    const index = (pages as Record<string, any>[]).findIndex(
                        ({ pageid }) => page.pageid === pageid,
                    );

                    pages[index] = {
                        ...pages[index],
                        ...page,
                    };
                });
            }

            continueData = response?.continue;
        }

        resolve(data!);
    }

    addInputs(inputs: ApiParam[]): Promise<ApiResponse>[] {
        let unprocessedInputs = inputs;
        const outputs: Promise<ApiResponse>[] = [];

        while (unprocessedInputs.length) {
            const availableSpace = 50 - this.inputs.length;
            const inputsToAdd = unprocessedInputs.slice(0, availableSpace);
            unprocessedInputs = unprocessedInputs.slice(availableSpace);

            this.inputs.push(...inputsToAdd);

            if (!this.output) {
                this.output = new Promise((resolve) => {
                    this.resolve = resolve;
                });

                this.timeout = setTimeout(
                    () => this.executeBatch(),
                    RequestBatch.batchingInterval,
                );
            }

            outputs.push(this.output);

            if (this.inputs.length >= 50) {
                this.executeBatch();
            }
        }

        return outputs;
    }
}
