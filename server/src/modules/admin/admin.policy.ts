import { AppError } from '../../common/AppError.js'
import { isAccountLocked } from '../../common/accountState.js'
import type { Action, ActionPayload } from './admin.validation.js'

export interface AdminAccount {
  _id: { toString(): string }; email: string; username: string; displayName: string; provider: string
  role: string; authorStatus?: string; isEmailVerified: boolean; isLocked: boolean; lockedReason?: string
  lockKind?: string; suspendedUntil?: Date; adminVersion?: number; authVersion?: number; createdAt: Date
}

/** Explicit projection also protects audit records from credential or avatar leakage. */
export function adminUserDto(user: AdminAccount) {
  return { id: user._id.toString(), email: user.email, username: user.username, displayName: user.displayName,
    provider: user.provider, role: user.role, authorStatus: user.authorStatus, isEmailVerified: user.isEmailVerified,
    isLocked: isAccountLocked(user), lockedReason: user.lockedReason, lockKind: user.lockKind,
    suspendedUntil: user.suspendedUntil, adminVersion: user.adminVersion ?? 0, createdAt: user.createdAt }
}

/** Pure state machine; authorization and serialization are enforced inside the repository transaction. */
export function planAccountMutation(actorId: string, user: AdminAccount, action: Action, input: ActionPayload, now = new Date()) {
  if (actorId === user._id.toString()) throw AppError.forbidden('Không được thay đổi quyền/khóa chính mình', 'SELF_ADMIN_ACTION')
  if ((user.adminVersion ?? 0) !== input.expectedVersion) throw AppError.conflict('Dữ liệu đã thay đổi; tải lại trước khi xác nhận', 'VERSION_CONFLICT')
  const patch: Record<string, unknown> = { adminVersion: (user.adminVersion ?? 0) + 1 }
  if (action === 'ban' || action === 'suspend') {
    if (action === 'suspend' && isAccountLocked(user) && user.lockKind !== 'suspend') throw AppError.conflict('Phải mở khóa ban trước khi chuyển sang đình chỉ có hạn', 'INVALID_TRANSITION')
    if (action === 'ban' && isAccountLocked(user) && user.lockKind !== 'suspend') throw AppError.conflict('Tài khoản đã bị ban', 'INVALID_TRANSITION')
    Object.assign(patch, { isLocked: true, lockKind: action === 'ban' ? 'ban' : 'suspend', lockedReason: input.reason,
      suspendedUntil: action === 'suspend' && 'days' in input ? new Date(now.getTime() + input.days * 86400000) : null })
  } else if (action === 'unban') {
    if (!user.isLocked) throw AppError.conflict('Tài khoản chưa bị khóa', 'INVALID_TRANSITION')
    Object.assign(patch, { isLocked: false, lockKind: null, lockedReason: null, suspendedUntil: null })
  } else if (action === 'role' && 'role' in input) {
    if (user.role === input.role) throw AppError.conflict('Quyền đã có hiệu lực', 'INVALID_TRANSITION')
    if (input.role === 'author' && user.authorStatus !== 'approved') throw AppError.conflict('Cần duyệt tác giả trước', 'AUTHOR_NOT_APPROVED')
    Object.assign(patch, { role: input.role })
    if (user.role === 'author' && input.role !== 'author') patch.authorStatus = 'revoked'
  } else if (action === 'author-status' && 'status' in input) {
    if (user.role === 'admin' || user.role === 'moderator') throw AppError.conflict('Không thay đổi quyền quản trị qua duyệt tác giả', 'INVALID_TRANSITION')
    if (input.status === 'approved' && !['pending', 'revoked'].includes(user.authorStatus ?? '')) throw AppError.conflict('Không có yêu cầu tác giả hợp lệ', 'INVALID_TRANSITION')
    if (input.status === 'revoked' && (user.role !== 'author' || user.authorStatus !== 'approved')) throw AppError.conflict('Tác giả chưa được duyệt', 'INVALID_TRANSITION')
    Object.assign(patch, { authorStatus: input.status, role: input.status === 'approved' ? 'author' : 'user' })
  }
  // Every privilege change invalidates existing sessions, including previously suspended tokens after unban.
  if (action !== 'unban') patch.authVersion = (user.authVersion ?? 0) + 1
  const after = { ...user, ...patch } as AdminAccount
  return { patch, after, reducesAdmin: user.role === 'admin' && !isAccountLocked(user, now.getTime()) && (after.role !== 'admin' || isAccountLocked(after, now.getTime())) }
}
