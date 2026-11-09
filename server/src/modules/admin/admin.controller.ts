import { asyncHandler } from '../../common/asyncHandler.js'
import { ApiResponse } from '../../common/ApiResponse.js'
import { adminService } from './admin.service.js'
import { actionPayloads, type Action, type ActionPayload, type UsersQuery, type StoriesQuery, type AuditQuery, type ChartsQuery } from './admin.validation.js'
import type { Request } from 'express'

const sessionToken = (req: Request) => req.headers.authorization?.slice(7) ?? ''
export const adminController = {
  overview: asyncHandler(async (_req, res) => ApiResponse.success(res, await adminService.overview())),
  charts: asyncHandler(async (req, res) => ApiResponse.success(res, await adminService.charts(req.query as unknown as ChartsQuery))),
  users: asyncHandler(async (req, res) => { const { items, meta } = await adminService.users(req.query as unknown as UsersQuery); return ApiResponse.success(res, items, { meta }) }),
  user: asyncHandler(async (req, res) => ApiResponse.success(res, await adminService.user(req.params.id as string))),
  stories: asyncHandler(async (req, res) => { const { items, meta } = await adminService.stories(req.query as unknown as StoriesQuery); return ApiResponse.success(res, items, { meta }) }),
  audit: asyncHandler(async (req, res) => { const { items, meta } = await adminService.audit(req.query as unknown as AuditQuery); return ApiResponse.success(res, items, { meta }) }),
  config: asyncHandler(async (_req, res) => ApiResponse.success(res, await adminService.config())),
  updateConfig: asyncHandler(async (req, res) => ApiResponse.success(res, await adminService.updateConfig(req.user!.id, req.body, req.id ?? 'unknown', req.user!.authVersion ?? 0))),
  confirm: asyncHandler(async (req, res) => {
    const { action, targetId, payload, password } = req.body as { action: Action; targetId: string; payload: ActionPayload; password: string }
    return ApiResponse.success(res, await adminService.confirm(req.user!.id, sessionToken(req), action, targetId, actionPayloads[action].parse(payload), password, req.user!.authVersion ?? 0))
  }),
  mutate: (action: Action) => asyncHandler(async (req, res) => {
    const { actionReceipt, ...payload } = req.body
    return ApiResponse.success(res, await adminService.mutateUser(req.user!.id, sessionToken(req), req.params.id as string, action, actionPayloads[action].parse(payload), actionReceipt, req.id ?? 'unknown', req.user!.authVersion ?? 0))
  }),
  backups: asyncHandler(async (req, res) => ApiResponse.success(res, await adminService.backups(req.query as unknown as { cursor?: string; limit: number }))),
  enqueueBackup: asyncHandler(async (req, res) => ApiResponse.success(res, await adminService.enqueueBackup(req.user!.id, req.user!.authVersion ?? 0, req.body.reason, req.id ?? 'unknown'), { statusCode: 202 })),
}
