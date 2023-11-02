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

        await this.bucket.acquireToken();

        const data = await this.bot.query({
            ...(params as any),
            [batchAxis]: inputs,
        });
        resolve(data);
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
