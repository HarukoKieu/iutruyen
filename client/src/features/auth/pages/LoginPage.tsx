import React, { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoginForm } from '../components/LoginForm'
import { OAuthButtons } from '../components/OAuthButtons'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { toast } from 'sonner'

export const LoginPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const error = searchParams.get('error')

  useEffect(() => {
    if (error) {
      if (error === 'google_not_configured') {
        toast.error('Đăng nhập Google hiện chưa sẵn sàng. Vui lòng đăng nhập bằng email.')
      } else if (error === 'google_failed') {
        toast.error('Đăng nhập bằng Google thất bại')
      } else {
        toast.error('Đăng nhập mạng xã hội thất bại')
      }
      // Clean query param
      setSearchParams({}, { replace: true })
    }
  }, [error, setSearchParams])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <Card className="rounded-3xl border border-border bg-card p-2 sm:p-4 shadow-xl">
          <CardHeader className="space-y-2 text-center pb-4">
            <div className="flex justify-center pb-2">
              <BrandLogo size="lg" showTagline />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Đăng nhập</h1>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Chào mừng bạn quay trở lại với thế giới truyện chữ
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <OAuthButtons />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground font-medium">Hoặc đăng nhập với email</span>
              </div>
            </div>

            <LoginForm />

            <div className="text-center text-sm text-muted-foreground pt-2">
              Chưa có tài khoản?{' '}
              <Link to="/register" className="font-semibold text-link hover:underline">
                Đăng ký ngay
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default LoginPage
