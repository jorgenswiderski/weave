import Bunyan from 'bunyan';
import RotatingFileStream from 'bunyan-rotating-file-stream';
import fs from 'fs';
import path from 'path';

fs.mkdirSync('logs', { recursive: true });

const uncaughtExceptionLogPath = path.join('logs', 'weave-uncaught.log');

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

process.on('uncaughtException', (err) => {
    try {
        // Bunyan doesn't like to finish flushing to disk before we kill the process, so let's take things into our own hands
        const timeStamp = new Date().toISOString();

        const errorLogMessage = `${timeStamp} - ${err.stack || err}\n`;

        // Write the error synchronously to the 'weave-uncaught.log'
        fs.writeFileSync(uncaughtExceptionLogPath, errorLogMessage, {
            flag: 'a',
        });
    } catch (writeErr) {
        // If there's an error writing to the log file, log it to the console
        console.error(
            'Error writing uncaught exception to log file:',
            writeErr,
        );
    }

    // Finally, exit the process
    process.exit(1);
});

// Log uncaught promise rejections
process.on('unhandledRejection', (reason) => {
    if (reason instanceof Error) {
        // If the reason is an error, Bunyan will serialize it properly.
        Logger.error(reason, 'An uncaught promise rejection occurred');
    } else {
        // If it's not an error (like a string), you have to handle it manually.
        Logger.error(reason, 'An uncaught promise rejection occurred');
    }
});

export const { debug, log, error, warn } = Logger;
