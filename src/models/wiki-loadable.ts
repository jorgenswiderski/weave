export class WikiLoadable {
    initialized: Record<string, Promise<any>> = {};

    async waitForInitialization(): Promise<any> {
        return Promise.all(Object.values(this.initialized));
    }
}
