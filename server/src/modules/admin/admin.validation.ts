import { z } from 'zod'

export const objectId = z.string().regex(/^[a-f\d]{24}$/i)
export const roles = z.enum(['user', 'author', 'moderator', 'admin'])
export const actions = z.enum(['ban', 'unban', 'suspend', 'role', 'author-status'])
const reason = z.string().trim().min(10).max(500)
const version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const base = { reason, expectedVersion: version }
export const actionPayloads = {
  ban: z.object(base).strict(), unban: z.object(base).strict(),
  suspend: z.object({ ...base, days: z.number().int().min(1).max(30) }).strict(),
  role: z.object({ ...base, role: roles }).strict(),
  'author-status': z.object({ ...base, status: z.enum(['approved', 'revoked']) }).strict(),
}
export const confirmationSchema = z.object({
  action: actions, targetId: objectId, password: z.string().min(1).max(256), payload: z.unknown(),
}).strict().superRefine((input, ctx) => {
  const result = actionPayloads[input.action].safeParse(input.payload)
  if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ ...issue, path: ['payload', ...issue.path] })
})
export const mutationSchema = (action: Action) => actionPayloads[action].extend({ actionReceipt: z.string().regex(/^[a-f\d]{64}$/) }).strict()
export const idParams = z.object({ id: objectId }).strict()
const page = { cursor: z.string().min(1).max(1500).optional(), limit: z.coerce.number().int().min(1).max(100).default(20) }
export const usersQuery = z.object({ ...page, role: roles.optional(), authorStatus: z.enum(['pending', 'approved', 'revoked']).optional(), status: z.enum(['active', 'locked']).optional(), q: z.string().trim().max(100).optional() }).strict()
export const storiesQuery = z.object({ ...page, moderationStatus: z.enum(['pending', 'approved', 'hidden', 'removed']).optional(), q: z.string().trim().max(100).optional() }).strict()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Invalid date')
export const chartsQuery = z.object({ metric: z.enum(['users', 'stories', 'views']), from: date, to: date }).strict().refine(({ from, to }) => Date.parse(to) >= Date.parse(from) && Date.parse(to) - Date.parse(from) < 90 * 86400000, 'Range must be 1–90 UTC days')
export const auditQuery = z.object({ ...page, actorId: objectId.optional(), targetId: z.union([objectId, z.literal('global')]).optional(), action: z.enum(['ban', 'unban', 'suspend', 'role', 'author-status', 'config', 'backup']).optional(), from: date.optional(), to: date.optional() }).strict().refine(q => !q.from || !q.to || q.to >= q.from, 'Invalid date range')
export const backupsQuery = z.object(page).strict()
export const backupSchema = z.object({ reason, acknowledgeNonSnapshot: z.literal(true) }).strict()
const plainText = (max: number) => z.string().trim().max(max).refine(value => !/[<>\u0000]/.test(value), 'Use plain text')
export const configSchema = z.object({ expectedVersion: version, reason, siteName: plainText(100).pipe(z.string().min(1)), description: plainText(500), announcement: plainText(1000) }).strict()
export type Action = z.infer<typeof actions>
export type ActionPayload = z.infer<(typeof actionPayloads)[Action]>
export type UsersQuery = z.infer<typeof usersQuery>
export type StoriesQuery = z.infer<typeof storiesQuery>
export type AuditQuery = z.infer<typeof auditQuery>
export type ChartsQuery = z.infer<typeof chartsQuery>
export type ConfigInput = z.infer<typeof configSchema>
