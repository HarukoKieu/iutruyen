import { createHash, randomUUID } from 'node:crypto'
import { redis } from '../../config/redis.js'
import { AppError } from '../../common/AppError.js'
import { signRefreshToken, type TokenPayload } from '../../common/jwt.js'

const TTL = 7 * 24 * 60 * 60
const digest = (token: string) => createHash('sha256').update(token).digest('hex')
const key = (id: string, family: string) => `session:family:{${id}:${family}}`
const revoked = () => AppError.unauthorized('Phiên đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.', 'TOKEN_REVOKED')

// Fixed session lifetime. Brief retries (parallel tabs / lost HTTP response) receive
// the current successor. Reuse outside the grace period revokes this family.
const ROTATE = `
local current = redis.call('GET', KEYS[1])
if not current then return false end
local record = cjson.decode(current)
if record.digest == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  redis.call('SET', KEYS[2], '1', 'EX', 10)
  return cjson.decode(ARGV[2]).token
end
if redis.call('EXISTS', KEYS[2]) == 1 then return record.token end
redis.call('DEL', KEYS[1])
return false
`

export async function startRefreshSession(payload: TokenPayload) {
  const family = randomUUID()
  const token = signRefreshToken({ ...payload, fid: family, jti: randomUUID() })
  await redis.set(key(payload.id, family), JSON.stringify({ digest: digest(token), token }), 'EX', TTL)
  return token
}
export async function rotateRefreshSession(payload: TokenPayload, presented: string) {
  if (typeof payload.fid !== 'string' || !/^[a-f\d-]{36}$/i.test(payload.fid) || typeof payload.exp !== 'number') throw revoked()
  const remaining = payload.exp - Math.floor(Date.now() / 1000)
  if (remaining <= 0) throw revoked()
  const next = signRefreshToken({
    id: payload.id, role: payload.role, authVersion: payload.authVersion, fid: payload.fid, jti: randomUUID(),
  }, { expiresIn: remaining })
  const familyKey = key(payload.id, payload.fid), presentedDigest = digest(presented)
  const result = await redis.eval(ROTATE, 2, familyKey, `${familyKey}:retry:${presentedDigest}`,
    presentedDigest, JSON.stringify({ digest: digest(next), token: next }), remaining)
  if (typeof result !== 'string') throw revoked()
  return result
}
export async function revokeRefreshSession(payload: TokenPayload) {
  if (typeof payload.fid === 'string' && /^[a-f\d-]{36}$/i.test(payload.fid)) await redis.del(key(payload.id, payload.fid))
}
