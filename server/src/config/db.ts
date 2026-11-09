import mongoose from 'mongoose'
import { env } from './env.js'
import { logger } from '../common/logger.js'

export const connectDB = async (): Promise<void> => {
  try {
    // Production index creation is a reviewed migration, not startup work on a live database.
    const conn = await mongoose.connect(env.MONGODB_URI, { autoIndex: env.NODE_ENV !== 'production' })
    logger.info(`🍃 MongoDB Connected: ${conn.connection.host}`)
  } catch (error) {
    logger.error('❌ MongoDB Connection Error:', error)
    process.exit(1)
  }
}
