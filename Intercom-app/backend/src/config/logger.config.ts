import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';
import { env } from './env.config.js';
import { PostgresLogTransport } from './postgres-log.transport.js';

const logsDirectory = path.resolve('logs');
const persistLocalLogFiles = env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test';
if (persistLocalLogFiles && !fs.existsSync(logsDirectory)) {
  fs.mkdirSync(logsDirectory, { recursive: true });
}

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const rest = { ...meta };
    delete rest.timestamp;
    const details = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest, null, 0)}` : '';
    return `${timestamp} ${level}: ${message}${details}`;
  })
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
  },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    ...(persistLocalLogFiles
      ? [
          new winston.transports.File({
            filename: path.join(logsDirectory, 'error.log'),
            level: 'error' as const
          }),
          new winston.transports.File({ filename: path.join(logsDirectory, 'combined.log') })
        ]
      : []),
    new PostgresLogTransport({ level: 'error' })
  ]
});
