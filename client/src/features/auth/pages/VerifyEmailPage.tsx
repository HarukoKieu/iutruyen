import React, { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useVerifyEmail } from '../hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isAxiosError } from 'axios'

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const urlToken = searchParams.get('token') || ''
  const urlCode = searchParams.get('code') || ''

  const [code, setCode] = useState(urlCode)
  const [token, setToken] = useState(urlToken)

  const { mutate: verifyEmail, isPending, isSuccess, isError, error } = useVerifyEmail()
  const submittedLink = useRef('')

  useEffect(() => {
    if (urlToken || urlCode) {
      const link = urlToken || urlCode
      if (submittedLink.current === link) return
      submittedLink.current = link
      if (urlToken) setToken(urlToken)
      if (urlCode) setCode(urlCode)
      verifyEmail({ token: urlToken || undefined, code: urlCode || undefined })
    }
  }, [urlToken, urlCode, verifyEmail])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedCode = code.trim()
    const trimmedToken = token.trim()

    if (!trimmedCode && !trimmedToken) return

    verifyEmail({
      code: trimmedCode || undefined,
      token: trimmedToken || undefined,
    })
  }

  const errorMessage = (isAxiosError<{ message?: string }>(error) && error.response?.data?.message) || 'Mã xác thực hoặc token không hợp lệ / đã hết hạn.'

  const hasInput = code.trim().length > 0 || token.trim().length > 0

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:py-12">
      <Card className="w-full max-w-md rounded-3xl border border-border bg-card shadow-xl text-center p-2 sm:p-4">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex justify-center pb-2">
            <BrandLogo size="lg" showTagline />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Xác thực tài khoản</h1>
            <CardDescription role="status" className="text-sm text-muted-foreground mt-1">
              {isSuccess
                ? 'Xác nhận email thành công. Vui lòng đăng nhập để tiếp tục.'
                : 'Nhập mã Code hoặc Token được gửi đến email của bạn để kích hoạt tài khoản.'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 text-left">
          {isSuccess ? (
            <div className="space-y-5 text-center">
              <div aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">
                Bây giờ bạn có thể trải nghiệm đầy đủ các tính năng trên Novel Web.
              </p>
              <div className="flex flex-col gap-2.5">
                <Button asChild variant="default" className="w-full">
                  <Link to="/">Về trang chủ</Link>
                </Button>
                <Button asChild variant="outline" className="w-full shadow-sm">
                  <Link to="/login">Đăng nhập</Link>
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="verificationCode">
                  Mã xác thực (Code)
                </Label>
                <Input
                  id="verificationCode"
                  type="text"
                  placeholder="Nhập mã xác thực (VD: 123456)..."
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  aria-invalid={isError || undefined}
                  aria-describedby={isError ? 'verification-error' : undefined}
                />
              </div>

              <div>
                <Label htmlFor="verificationToken">
                  Token xác thực (Token)
                </Label>
                <Input
                  id="verificationToken"
                  type="text"
                  placeholder="Dán token xác thực vào đây..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={isError || undefined}
                  aria-describedby={isError ? 'verification-error' : undefined}
                />
              </div>

              {isError && (
                <div id="verification-error" role="alert" className="rounded-2xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive break-words">
                  {errorMessage}
                </div>
              )}

              <Button
                type="submit"
                variant="default"
                className="mt-2 w-full rounded-full"
                isLoading={isPending}
                disabled={!hasInput}
              >
                Xác thực tài khoản
              </Button>

              <div className="text-center text-sm pt-2">
                <Link to="/" className="font-medium text-muted-foreground hover:text-foreground">
                  Quay lại trang chủ
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export default VerifyEmailPage
