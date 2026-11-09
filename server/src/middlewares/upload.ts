import multer from 'multer'
import { AppError } from '../common/AppError.js'

// Multer memory storage (no writing to disk)
const storage = multer.memoryStorage()

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, _file, cb) => {
    // Accept all files by default, specific routes can refine validation
    cb(null, true)
  },
})

export const handleMulterError = (err: any, _req: any, _res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(AppError.badRequest('File size exceeds the 5MB limit', 'FILE_TOO_LARGE'))
    }
    return next(AppError.badRequest(err.message, 'UPLOAD_ERROR'))
  }
  next(err)
}
