import winston from 'winston'
import { env } from '../config/env.js'

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
}

winston.addColors(colors)

const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, requestId, ...meta } = info
    const reqIdStr = requestId ? ` [${requestId}]` : ''
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
    return `${timestamp} ${level}${reqIdStr}: ${message}${metaStr}`
  })
)

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
)

export const logger = winston.createLogger({
  level: env.LOG_LEVEL === 'info' ? 'http' : env.LOG_LEVEL,
  levels,
  format: env.NODE_ENV === 'development' ? devFormat : prodFormat,
  transports: [
    new winston.transports.Console(),
  ],
})

// Stream for morgan http request logger
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim())
  },
}

export default logger
