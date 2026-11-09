import { Request, Response } from 'express'
import { usersService } from './users.service.js'
import { ApiResponse } from '../../common/ApiResponse.js'
import { clearRefreshTokenCookie } from '../auth/auth.controller.js'

export const getMe = async (req: Request, res: Response): Promise<void> => {
  const user = await usersService.getMe(req.user!.id)
  ApiResponse.success(res, user)
}

export const updateMe = async (req: Request, res: Response): Promise<void> => {
  const user = await usersService.updateMe(req.user!.id, req.body)
  ApiResponse.success(res, user, { message: 'Cập nhật thông tin thành công' })
}

export const updateAvatar = async (req: Request, res: Response): Promise<void> => {
  const user = await usersService.updateAvatar(req.user!.id, req.body.avatarBase64)
  ApiResponse.success(res, { avatarUrl: user.avatarUrl }, { message: 'Cập nhật ảnh đại diện thành công' })
}

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  await usersService.changePassword(req.user!.id, req.body)
  clearRefreshTokenCookie(res)
  ApiResponse.success(res, null, { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' })
}

export const changeEmail = async (req: Request, res: Response): Promise<void> => {
  const user = await usersService.changeEmail(req.user!.id, req.body)
  ApiResponse.success(
    res,
    { email: user.email },
    { message: 'Đã gửi liên kết xác nhận đến hộp thư mới. Email hiện tại được giữ nguyên cho đến khi xác nhận.' }
  )
}

export const becomeAuthor = async (req: Request, res: Response): Promise<void> => {
  const user = await usersService.becomeAuthor(req.user!.id)
  ApiResponse.success(
    res,
    { authorStatus: user?.authorStatus },
    { message: 'Gửi yêu cầu đăng ký làm tác giả thành công, đang chờ Admin duyệt.' }
  )
}

export const getPublicProfile = async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const profile = await usersService.getPublicProfile(id as string)
  ApiResponse.success(res, profile)
}

export const usersController = {
  getMe,
  updateMe,
  updateAvatar,
  changePassword,
  changeEmail,
  becomeAuthor,
  getPublicProfile,
}
