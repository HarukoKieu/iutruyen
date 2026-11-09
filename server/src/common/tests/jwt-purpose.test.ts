import { describe, expect, it, vi } from 'vitest'
vi.mock('../../config/env.js', async () => {
  const { generateKeyPairSync } = await import('node:crypto')
  const pair = () => generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  const access = pair(), refresh = pair()
  return { env: { JWT_PRIVATE_KEY: access.privateKey, JWT_PUBLIC_KEY: access.publicKey, JWT_REFRESH_PRIVATE_KEY: refresh.privateKey, JWT_REFRESH_PUBLIC_KEY: refresh.publicKey } }
})
import { signAccessToken, signRefreshToken, verifyToken } from '../jwt.js'
describe('separate RSA keys', () => {
  it('access verifier rejects refresh signatures and vice versa', () => {
    const access = signAccessToken({ id: 'user' }), refresh = signRefreshToken({ id: 'user' })
    expect(verifyToken(access)).toMatchObject({ type: 'access' })
    expect(verifyToken(refresh, undefined, true)).toMatchObject({ type: 'refresh' })
    expect(() => verifyToken(refresh)).toThrow()
    expect(() => verifyToken(access, undefined, true)).toThrow()
  })
})
