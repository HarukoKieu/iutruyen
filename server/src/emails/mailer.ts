import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { logger } from '../common/logger.js'

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

const getTransporter = () => {
  if (!transporter) {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      })
    }
  }
  return transporter
}

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export const sendEmail = async ({ to, subject, html }: SendEmailOptions): Promise<boolean> => {
  try {
    const transport = getTransporter()
    if (!transport) {
      logger.warn(`[Mailer] SMTP not configured. Email to ${to} with subject "${subject}" suppressed.`, {
        to,
        subject,
      })
      return false
    }

    await transport.sendMail({
      from: process.env.SMTP_FROM_EMAIL?.trim() || `"Novel Web" <${env.SMTP_USER || 'no-reply@novelweb.com'}>`,
      to,
      subject,
      html,
    })

    logger.info(`[Mailer] Email sent successfully to ${to}`)
    return true
  } catch (error) {
    logger.error(`[Mailer] Failed to send email to ${to}:`, error)
    return false
  }
}

export const sendVerificationEmail = async (email: string, token: string, emailChange = false): Promise<boolean> => {
  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${token}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2b2d42;">Xác thực tài khoản của bạn</h2>
      <p>${emailChange ? 'Xác nhận địa chỉ này làm email đăng nhập và khôi phục mới. Sau khi xác nhận, tất cả phiên đăng nhập cũ sẽ bị thu hồi.' : 'Cảm ơn bạn đã đăng ký tài khoản tại Novel Web! Vui lòng nhấn vào nút bên dưới để hoàn tất xác thực email.'}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verifyUrl}" style="background-color: #3b429f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Xác thực Email</a>
      </div>
      <p style="color: #666; font-size: 14px;">Hoặc sao chép đường link này vào trình duyệt của bạn:</p>
      <p style="word-break: break-all; color: #3b429f; font-size: 13px;">${verifyUrl}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999; font-size: 12px;">Link này sẽ hết hạn sau ${emailChange ? '30 phút' : '24 giờ'}. Nếu bạn không thực hiện yêu cầu, vui lòng bỏ qua email này.</p>
    </div>
  `
  return sendEmail({
    to: email,
    subject: '[Novel Web] Xác thực địa chỉ email',
    html,
  })
}

export const sendPasswordResetEmail = async (email: string, token: string): Promise<boolean> => {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2b2d42;">Yêu cầu đặt lại mật khẩu</h2>
      <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với email này.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #3b429f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Đặt lại mật khẩu</a>
      </div>
      <p style="color: #666; font-size: 14px;">Hoặc sao chép đường link này vào trình duyệt của bạn:</p>
      <p style="word-break: break-all; color: #3b429f; font-size: 13px;">${resetUrl}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999; font-size: 12px;">Link này sẽ hết hạn sau 1 giờ. Nếu bạn không thực hiện yêu cầu này, tài khoản của bạn vẫn an toàn.</p>
    </div>
  `
  return sendEmail({
    to: email,
    subject: '[Novel Web] Yêu cầu đặt lại mật khẩu',
    html,
  })
}
