import { Server as HttpServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { env } from './env.js'
import { logger } from '../common/logger.js'
import { verifyToken, TokenPayload } from '../common/jwt.js'
import { userRepository } from '../repositories/user.repository.js'
import { storyRepository } from '../repositories/story.repository.js'
import { Types } from 'mongoose'
import { isAccountLocked, isSessionCurrent } from '../common/accountState.js'

let io: SocketIOServer | null = null

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: TokenPayload
  }
}

/**
 * Extract token from Socket.IO handshake auth, headers, or cookies
 */
export const extractSocketToken = (socket: Socket): string | null => {
  // 1. Check auth payload: { auth: { token: '...' } }
  if (socket.handshake.auth?.token && typeof socket.handshake.auth.token === 'string') {
    const raw = socket.handshake.auth.token.trim()
    return raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw
  }

  // 2. Check Authorization header
  const authHeader = socket.handshake.headers.authorization
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }

  // 3. Check Cookie
  const cookieHeader = socket.handshake.headers.cookie
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)accessToken=([^;]+)/)
    if (match?.[1]) {
      return decodeURIComponent(match[1])
    }
  }

  return null
}

export const authenticateSocket = async (socket: AuthenticatedSocket): Promise<void> => {
  const token = extractSocketToken(socket)
  if (!token) return
  const payload = verifyToken<TokenPayload>(token)
  if (payload.type !== 'access' || typeof payload.id !== 'string' || typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) throw new Error('Invalid access token')
  const user = await userRepository.findById(payload.id)
  if (!user || isAccountLocked(user) || !isSessionCurrent(user, payload)) throw new Error('Account unavailable')
  if (user?.role) {
    payload.role = user.role
  }
  socket.data.user = payload
}

export const closeSocket = async (): Promise<void> => {
  if (io) await new Promise<void>(resolve => io!.close(() => resolve()))
  io = null
}

export const initSocket = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [
        env.CLIENT_URL,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
        'http://localhost:3000',
      ].filter(Boolean),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  io.use((socket: AuthenticatedSocket, next) => {
    authenticateSocket(socket).then(() => next(), () => next(new Error('UNAUTHORIZED')))
  })

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.data.user

    if (user?.id) {
      // Auto-join private user notification room
      const userRoom = `user:${user.id}`
      socket.join(userRoom)
      // Publish private events only to the current session epoch, including after a fast unban.
      socket.join(`${userRoom}:v${user.authVersion ?? 0}`)

      // Moderator & Admin shared room for review tasks, reports and moderation events
      if (user.role === 'admin' || user.role === 'moderator') {
        socket.join('room:moderators')
        logger.info(`🛡️ Socket connected & joined room:moderators: ${socket.id} (User: ${user.id}, Role: ${user.role})`)
      }

      logger.info(`⚡ Socket connected & authenticated: ${socket.id} (User: ${user.id}) joined ${userRoom}`)
    } else {
      logger.info(`⚡ Socket connected (Guest): ${socket.id}`)
    }

    // Story room joining for live updates
    socket.on('join:story', async (storyId: unknown) => {
      if (typeof storyId !== 'string' || !Types.ObjectId.isValid(storyId) || socket.rooms.size >= 22) return
      const story = await storyRepository.findById(storyId).catch(() => null)
      if (story?.moderationStatus === 'approved' && socket.connected) {
        socket.join(`story:${storyId}`)
        logger.debug(`Socket ${socket.id} joined story:${storyId}`)
      }
    })

    socket.on('leave:story', (storyId: string) => {
      if (storyId) {
        socket.leave(`story:${storyId}`)
        logger.debug(`Socket ${socket.id} left story:${storyId}`)
      }
    })

    const expireAt = typeof user?.exp === 'number' ? user.exp * 1000 : 0
    const expiryTimer = expireAt ? setTimeout(() => socket.disconnect(true), Math.max(0, expireAt - Date.now())) : undefined
    let checking = false
    const accountTimer = user ? setInterval(async () => {
      if (checking) return
      checking = true
      try {
        const current = await userRepository.findById(user.id)
        if (!current || isAccountLocked(current) || !isSessionCurrent(current, user)) socket.disconnect(true)
      } catch { socket.disconnect(true) } finally { checking = false }
    }, 15000) : undefined
    expiryTimer?.unref()
    accountTimer?.unref()
    socket.on('disconnect', (reason) => {
      clearTimeout(expiryTimer)
      clearInterval(accountTimer)
      logger.info(`⚡ Socket disconnected: ${socket.id} (${reason})`)
    })
  })

  return io
}

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized!')
  }
  return io
}

/**
 * Emit an event to a specific user via their private room
 */
export const emitToUser = async (userId: string, event: string, data: unknown): Promise<boolean> => {
  try {
    if (!io) return false
    const user = await userRepository.findById(userId)
    if (!user || isAccountLocked(user)) return false
    const room = `user:${userId}:v${user.authVersion ?? 0}`
    io.to(room).emit(event, data)
    return true
  } catch (error) {
    logger.error(`Failed to emit event "${event}" to user "${userId}":`, error)
    return false
  }
}

/**
 * Emit an event to a specific room
 */
export const emitToRoom = (room: string, event: string, data: any): boolean => {
  try {
    if (!io) return false
    io.to(room).emit(event, data)
    return true
  } catch (error) {
    logger.error(`Failed to emit event "${event}" to room "${room}":`, error)
    return false
  }
}

/**
 * Emit an event to all connected moderators and admins
 */
export const emitToModerators = (event: string, data: unknown): boolean => {
  return emitToRoom('room:moderators', event, data)
}

/** Permission changes revoke private Socket sessions immediately in this process. */
export const disconnectUserSockets = (userId: string): void => {
  io?.in(`user:${userId}`).disconnectSockets(true)
}
