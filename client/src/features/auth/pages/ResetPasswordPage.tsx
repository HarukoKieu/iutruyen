import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useResetPassword } from '../hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')

  const { mutate: resetPassword, isPending } = useResetPassword()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }

    resetPassword({ token, newPassword })
  }

  if (!token) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:py-12">
        <Card className="w-full max-w-md rounded-3xl border border-border bg-card shadow-xl text-center p-6 space-y-4">
          <div className="flex justify-center pb-2">
            <BrandLogo size="lg" showTagline />
          </div>
          <h1 className="text-xl font-bold">Mã xác thực không hợp lệ</h1>
          <CardDescription>Liên kết đặt lại mật khẩu của bạn thiếu mã xác thực hợp lệ.</CardDescription>
          <Button asChild variant="default" className="w-full rounded-full">
            <Link to="/forgot-password">Yêu cầu liên kết mới</Link>
          </Button>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <Card className="rounded-3xl border border-border bg-card p-2 sm:p-4 shadow-xl">
          <CardHeader className="space-y-2 text-center pb-4">
            <div className="flex justify-center pb-2">
              <BrandLogo size="lg" showTagline />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Đặt lại mật khẩu</h1>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Nhập mật khẩu mới cho tài khoản của bạn
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="newPassword" required>
                  Mật khẩu mới
                </Label>
                <PasswordInput
                  id="newPassword"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  error={error}
                  required
                  autoComplete="new-password"
                  aria-describedby="reset-password-help"
                />
                <p id="reset-password-help" className="mt-1 px-3 text-xs text-muted-foreground">
                  Mật khẩu mới phải có ít nhất 6 ký tự.
                </p>
              </div>

              <Button
                type="submit"
                variant="default"
                className="mt-2 w-full rounded-full"
                isLoading={isPending}
              >
                Cập nhật mật khẩu
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default ResetPasswordPage
