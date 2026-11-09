interface AccountState {
  isLocked?: boolean
  lockKind?: string
  suspendedUntil?: Date | string
  authVersion?: number
}

/** Legacy locks fail closed; only a valid, elapsed suspension unlocks automatically. */
export function isAccountLocked(user: AccountState, now = Date.now()): boolean {
  if (!user.isLocked) return false
  if (user.lockKind !== 'suspend' || !user.suspendedUntil) return true
  const deadline = new Date(user.suspendedUntil).getTime()
  return !Number.isFinite(deadline) || deadline > now
}

/** Missing epoch is backward compatible exclusively with accounts never revoked. */
export function isSessionCurrent(user: AccountState, payload: { authVersion?: unknown }): boolean {
  return (payload.authVersion ?? 0) === (user.authVersion ?? 0)
}
