export enum QueueName {
  EMAIL = 'email-queue',
}

export type EmailJobName =
  | 'send_verification_email'
  | 'send_password_reset_email'
  | 'send_general_email'

export interface VerificationEmailPayload {
  type: 'verification'
  email: string
  token: string
  emailChange?: boolean
}

export interface PasswordResetEmailPayload {
  type: 'password_reset'
  email: string
  token: string
}

export interface GeneralEmailPayload {
  type: 'general'
  to: string
  subject: string
  html: string
}

export type EmailJobPayload =
  | VerificationEmailPayload
  | PasswordResetEmailPayload
  | GeneralEmailPayload

export interface QueueHealthStats {
  queueName: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: boolean
}
