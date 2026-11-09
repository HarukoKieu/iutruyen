import React from 'react'
import { Link } from 'react-router-dom'
import { RegisterForm } from '../components/RegisterForm'
import { OAuthButtons } from '../components/OAuthButtons'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { BrandLogo } from '@/components/brand/BrandLogo'

export const RegisterPage: React.FC = () => {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <Card className="rounded-3xl border border-border bg-card p-2 sm:p-4 shadow-xl">
          <CardHeader className="space-y-2 text-center pb-4">
            <div className="flex justify-center pb-2">
              <BrandLogo size="lg" showTagline />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Đăng ký tài khoản</h1>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Bắt đầu hành trình đọc và chia sẻ truyện của bạn
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
                <span className="bg-card px-3 text-muted-foreground font-medium">Hoặc đăng ký bằng email</span>
              </div>
            </div>

            <RegisterForm />

            <div className="text-center text-sm text-muted-foreground pt-2">
              Đã có tài khoản?{' '}
              <Link to="/login" className="font-semibold text-link hover:underline">
                Đăng nhập
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default RegisterPage
