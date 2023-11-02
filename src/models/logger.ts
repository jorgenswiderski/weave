import Bunyan from 'bunyan';
import RotatingFileStream from 'bunyan-rotating-file-stream';
import fs from 'fs';

fs.mkdirSync('logs', { recursive: true });

const bunyan = Bunyan.createLogger({
    name: 'weave',
    serializers: Bunyan.stdSerializers,
    streams: [
        {
            level: 'debug',
            stream: process.stdout,
        },
        {
            level: 'info',
            type: 'raw',
            stream: new RotatingFileStream({
                path: 'logs/weave.log',
                period: '1d', // Rotate daily
                totalFiles: 10, // Keep 10 days' worth of logs
                rotateExisting: true,
                threshold: '10m', // Rotate log files larger than 10 megabytes
                totalSize: '20m', // Don't keep more than 20mb of archived log files
                gzip: true, // Compress the archive log files to save space
            }) as any,
        },
        {
            level: 'warn',
            type: 'raw',
            stream: new RotatingFileStream({
                path: 'logs/weave-error.log',
                rotateExisting: true,
                threshold: '4m',
                totalSize: '20m',
                gzip: true,
            }) as any,
        },
    ],
});

/* eslint-disable no-console */
export class Logger {
    static debug = bunyan.debug.bind(bunyan);
    static log = bunyan.info.bind(bunyan);
    static error = bunyan.error.bind(bunyan);
    static warn = bunyan.warn.bind(bunyan);
}

export const { debug, log, error, warn } = Logger;
