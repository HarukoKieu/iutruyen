import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { useLogin } from '../hooks/useAuth'

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { mutate: login, isPending } = useLogin()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    login({ email, password })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email" required>
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <Label htmlFor="password" required>
            Mật khẩu
          </Label>
          <Link
            to="/forgot-password"
            className="inline-flex min-h-8 items-center text-xs text-link hover:underline font-medium"
          >
            Quên mật khẩu?
          </Link>
        </div>
        <PasswordInput
          id="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      <Button
        type="submit"
        variant="default"
        className="mt-2 w-full rounded-full font-medium"
        isLoading={isPending}
      >
        Đăng nhập
      </Button>
    </form>
  )
}
