import { describe, expect, it, vi } from 'vitest'
import { randomBytes } from 'node:crypto'
import { restoreToIsolatedDatabase } from '../local-backup.restore.js'

describe('isolated restore guards', () => {
  const input = { archive: 'UNREAD_PRIVATE_ARCHIVE', key: randomBytes(32), sha256: 'a'.repeat(64), sourceDatabase: 'novel', uri: '', mongoConfigFile: 'UNREAD_PRIVATE_CONFIG' }
  it.each(['mongodb://remote.example/novel_backup_restore_test_' + 'a'.repeat(32), 'mongodb://127.0.0.1/production', 'mongodb://127.0.0.1/novel_backup_restore_test_notrandom', 'mongodb+srv://remote.example/production', 'not-uri'])('rejects target before reading files or starting a restore process: %s', async uri => {
    const run = vi.fn()
    await expect(restoreToIsolatedDatabase({ ...input, uri }, run)).rejects.toMatchObject({ code: 'RESTORE_TARGET_REJECTED' })
    expect(run).not.toHaveBeenCalled()
  })
  it('cannot restore system databases or wildcard namespaces', async () => {
    const uri = 'mongodb://127.0.0.1/novel_backup_restore_test_' + 'a'.repeat(32)
    for (const sourceDatabase of ['admin', 'local', 'config', '*', 'novel.*']) await expect(restoreToIsolatedDatabase({ ...input, uri, sourceDatabase }, vi.fn())).rejects.toMatchObject({ code: 'RESTORE_TARGET_REJECTED' })
  })
})
