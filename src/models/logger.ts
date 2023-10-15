/* eslint-disable no-console */
export class Logger {
    static base(func: Function, ...args: any[]) {
        func(...args);
    }

    static debug = (...args: any[]) => this.base(console.debug, ...args);
    static log = (...args: any[]) => this.base(console.log, ...args);
    static error = (...args: any[]) => this.base(console.error, ...args);
    static warn = (...args: any[]) => this.base(console.warn, ...args);
}

export const { debug, log, error, warn } = Logger;
