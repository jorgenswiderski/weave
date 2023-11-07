export class RemoteImageError extends Error {
    constructor(public statusCode: number) {
        super();
    }
}
