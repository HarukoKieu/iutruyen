import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { useRegister } from '../hooks/useAuth'

export const RegisterForm: React.FC = () => {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const { mutate: register, isPending } = useRegister()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')

    if (password.length < 6) {
      setPasswordError('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }

    register({ email, username, password })
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
        <Label htmlFor="username" required>
          Tên đăng nhập
        </Label>
        <Input
          id="username"
          type="text"
          placeholder="user_name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          aria-describedby="username-help"
        />
        <p id="username-help" className="mt-1 px-3 text-xs text-muted-foreground">
          Chỉ gồm chữ cái, số và dấu gạch dưới (từ 3 - 30 ký tự)
        </p>
      </div>

      <div>
        <Label htmlFor="password" required>
          Mật khẩu
        </Label>
        <PasswordInput
          id="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
          required
          autoComplete="new-password"
          aria-describedby="register-password-help"
        />
        <p id="register-password-help" className="mt-1 px-3 text-xs text-muted-foreground">
          Mật khẩu phải có ít nhất 6 ký tự.
        </p>
      </div>

      <Button
        type="submit"
        variant="default"
        className="mt-2 w-full rounded-full font-medium"
        isLoading={isPending}
      >
        Tạo tài khoản
      </Button>
    </form>
  )
}
