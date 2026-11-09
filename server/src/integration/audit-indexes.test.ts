import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import { randomUUID } from 'node:crypto'
import { writeFile, unlink } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

describe.skipIf(process.env.RUN_REMEDIATION_INTEGRATION !== '1')('additive audit index migration', () => {
  it('defaults to dry-run, refuses mismatched database and is idempotent without dropping data/indexes', async () => {
    const database = `novel_audit_indexes_test_${randomUUID().replaceAll('-', '')}`
    const uri = `mongodb://127.0.0.1:27028/${database}?directConnection=true&replicaSet=rs0`
    const config = path.resolve('node_modules', `${database}.json`)
    const connection = mongoose.createConnection(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 })
    const run = (args: string[]) => promisify(execFile)(process.execPath, [path.resolve('scripts/migrate-audit-indexes.cjs'), config, ...args], { timeout: 30000, windowsHide: true })
    try {
      await connection.asPromise()
      await writeFile(config, JSON.stringify({ uri }), { flag: 'wx', mode: 0o600 })
      await expect(run(['different_database', '--apply'])).rejects.toMatchObject({ code: 1 })
      const planned = JSON.parse((await run([database])).stdout)
      expect(planned.status).toBe('AUDIT_INDEXES_PLAN')
      expect(planned.indexes).toHaveLength(9)
      expect(await connection.db!.listCollections().toArray()).toHaveLength(0)
      await connection.db!.collection('stories').insertOne({ marker: 'preserve' })
      await connection.db!.collection('stories').createIndex({ marker: 1 })
      expect(JSON.parse((await run([database, '--apply'])).stdout).indexes).toHaveLength(9)
      expect(JSON.parse((await run([database])).stdout).indexes).toHaveLength(0)
      expect(await connection.db!.collection('stories').countDocuments({ marker: 'preserve' })).toBe(1)
      expect((await connection.db!.collection('stories').indexes()).some(index => index.key.marker === 1)).toBe(true)
    } finally {
      if (connection.name === database && database.startsWith('novel_audit_indexes_test_')) await connection.dropDatabase()
      await connection.close()
      await unlink(config).catch(() => {})
    }
  }, 60000)
})
