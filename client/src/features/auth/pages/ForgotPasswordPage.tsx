import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForgotPassword } from '../hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const { mutate: forgotPassword, isPending } = useForgotPassword()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    forgotPassword(email, {
      onSuccess: () => {
        setSubmitted(true)
      },
    })
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
              <h1 className="text-2xl font-bold text-foreground">Quên mật khẩu</h1>
              <CardDescription role="status" className="text-sm text-muted-foreground mt-1">
                {submitted
                  ? 'Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn nếu tài khoản tồn tại.'
                  : 'Nhập email đã đăng ký tài khoản để nhận liên kết đặt lại mật khẩu.'}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email" required>
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  variant="default"
                  className="w-full rounded-full"
                  isLoading={isPending}
                >
                  Gửi yêu cầu
                </Button>
              </form>
            ) : (
              <Button asChild variant="default" className="w-full rounded-full">
                <Link to="/login">Quay lại trang Đăng nhập</Link>
              </Button>
            )}

            <div className="text-center text-sm pt-2">
              <Link to="/login" className="font-semibold text-link hover:underline">
                Quay lại Đăng nhập
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default ForgotPasswordPage
