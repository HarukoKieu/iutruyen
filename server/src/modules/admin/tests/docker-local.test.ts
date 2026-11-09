import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createPublicKey } from 'node:crypto'

const { initializeLocalSecrets } = createRequire(__filename)('../../../../docker/local-secrets.cjs') as { initializeLocalSecrets(paths: Record<string, string>): Promise<{ status: string }> }
const database = 'novel_docker_fixture'
let directory: string, folders: Record<string, string>
beforeEach(async () => {
  directory = await mkdtemp(path.resolve('node_modules/docker-local-test-'))
  folders = Object.fromEntries(['secrets', 'archive', 'redisData', 'mongoData'].map(key => [key, path.join(directory, key)]))
  await Promise.all(Object.values(folders).map(folder => mkdir(folder)))
})
afterEach(async () => { if (!directory.startsWith(path.resolve('node_modules/docker-local-test-'))) throw new Error('Cleanup guard'); await rm(directory, { recursive: true, force: true }) })
describe('Docker local secret provisioning', () => {
  it('creates separate keys/credentials, restrictive files and matching backup config without leaking in output', async () => {
    const result = await initializeLocalSecrets({ ...folders, database })
    expect(result).toEqual({ status: 'LOCAL_SECRETS_READY' })
    const runtime = JSON.parse(await readFile(path.join(folders.secrets, 'backend/runtime.json'), 'utf8'))
    const mongoConfig = JSON.parse(await readFile(path.join(folders.secrets, 'backend/backup-mongo-config.json'), 'utf8'))
    expect(mongoConfig.uri).toBe(runtime.MONGODB_URI)
    expect(runtime.MONGODB_URI).toMatch(/^mongodb:\/\/novel_app:[a-f\d]{64}@mongo:27017\/novel_docker_fixture/)
    const access = createPublicKey(Buffer.from(runtime.JWT_PRIVATE_KEY, 'base64')).export({ type: 'spki', format: 'pem' })
    const refresh = createPublicKey(Buffer.from(runtime.JWT_REFRESH_PRIVATE_KEY, 'base64')).export({ type: 'spki', format: 'pem' })
    expect(access).toBe(Buffer.from(runtime.JWT_PUBLIC_KEY, 'base64').toString()); expect(refresh).not.toBe(access)
    const key = await readFile(path.join(folders.secrets, 'backend/backup-key'), 'utf8')
    expect(Buffer.from(key, 'base64')).toHaveLength(32)
    expect(await readFile(path.join(folders.secrets, 'restore/backup-key'), 'utf8')).toBe(key)
    expect(await readFile(path.join(folders.secrets, 'redis/password'), 'utf8')).toBe(runtime.REDIS_PASSWORD)
    expect(await readdir(folders.archive)).toEqual([])
  })
  it('restart keeps every key/password identical instead of rotating credentials', async () => {
    await initializeLocalSecrets({ ...folders, database })
    const file = path.join(folders.secrets, 'backend/runtime.json'), first = await readFile(file)
    await writeFile(path.join(folders.mongoData, 'WiredTiger'), 'existing database')
    await initializeLocalSecrets({ ...folders, database })
    expect(await readFile(file)).toEqual(first)
  })
  it('missing secret with existing DB/cache/archive refuses initialization and preserves data', async () => {
    for (const key of ['mongoData', 'redisData', 'archive']) {
      const file = path.join(folders[key], 'existing'); await writeFile(file, 'preserve')
      await expect(initializeLocalSecrets({ ...folders, database })).rejects.toThrow('LOCAL_SECRETS_MISSING_OR_INCOMPLETE')
      expect(await readFile(file, 'utf8')).toBe('preserve'); await rm(file)
    }
  })
  it('partial initialization or mismatched recovery key cannot silently regenerate', async () => {
    await mkdir(path.join(folders.secrets, 'partial'))
    await expect(initializeLocalSecrets({ ...folders, database })).rejects.toThrow('LOCAL_SECRETS_MISSING_OR_INCOMPLETE')
    await rm(path.join(folders.secrets, 'partial'), { recursive: true })
    await initializeLocalSecrets({ ...folders, database })
    await writeFile(path.join(folders.secrets, 'restore/backup-key'), 'different')
    await expect(initializeLocalSecrets({ ...folders, database })).rejects.toThrow('LOCAL_BACKUP_KEY_MISMATCH')
  })
  it('unset/removed/system database cannot initialize files; changing the target cannot reuse old credentials silently', async () => {
    for (const value of ['', 'novel_local', 'admin', 'config', 'local', '../other']) await expect(initializeLocalSecrets({ ...folders, database: value })).rejects.toThrow('LOCAL_DATABASE_NOT_CONFIGURED')
    expect(await readdir(folders.secrets)).toEqual([])
    await initializeLocalSecrets({ ...folders, database })
    const before = await readFile(path.join(folders.secrets, 'backend/runtime.json'))
    await expect(initializeLocalSecrets({ ...folders, database: 'different_database' })).rejects.toThrow('LOCAL_DATABASE_CONFIG_MISMATCH')
    expect(await readFile(path.join(folders.secrets, 'backend/runtime.json'))).toEqual(before)
  })
})
