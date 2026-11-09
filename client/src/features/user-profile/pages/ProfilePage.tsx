import React, { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  User as UserIcon,
  KeyRound,
  Mail,
  Camera,
  Feather,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/features/auth/store/authStore'
import { ROUTES } from '@/constants/routes'
import {
  useUpdateProfile,
  useUpdateAvatar,
  useChangePassword,
  useChangeEmail,
} from '@/features/auth/hooks/useUser'
import { toast } from 'sonner'

export const ProfilePage: React.FC = () => {
  const user = useAuthStore((state) => state.user)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form states
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')

  // Hooks
  const { mutate: updateProfile, isPending: isUpdatingProfile } = useUpdateProfile()
  const { mutate: updateAvatar, isPending: isUpdatingAvatar } = useUpdateAvatar()
  const { mutate: changePassword, isPending: isChangingPassword } = useChangePassword()
  const { mutate: changeEmail, isPending: isChangingEmail } = useChangeEmail()

  // Handle Avatar file selection -> Base64
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Limit ~500KB raw
    if (file.size > 500 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 500KB')
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp hình ảnh')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      const base64String = reader.result as string
      setAvatarPreview(base64String)
      updateAvatar(base64String)
    }
    reader.readAsDataURL(file)
  }

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfile({ displayName, bio })
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')

    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }

    changePassword(
      { oldPassword, newPassword },
      {
        onSuccess: () => {
          setOldPassword('')
          setNewPassword('')
        },
      }
    )
  }

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail) return
    changeEmail(
      { newEmail, oldPassword: emailPassword },
      {
        onSuccess: () => {
          setNewEmail('')
          setEmailPassword('')
        },
      }
    )
  }

  if (!user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:py-12">
        <Card className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-xl">
          <h1 className="text-2xl font-bold">Vui lòng đăng nhập</h1>
          <CardDescription className="mt-2 text-muted-foreground">
            Bạn cần đăng nhập để xem và quản lý thông tin tài khoản cá nhân.
          </CardDescription>
          <Button asChild className="mt-6 w-full">
            <Link to="/login">Đăng nhập ngay</Link>
          </Button>
        </Card>
      </main>
    )
  }

  const roleLabels: Record<string, { label: string; bg: string; text: string }> = {
    admin: { label: 'Quản trị viên', bg: 'bg-accent/10 border-accent/20', text: 'text-accent' },
    author: { label: 'Tác giả', bg: 'bg-primary/10 border-primary/20', text: 'text-link' },
    moderator: { label: 'Kiểm duyệt viên', bg: 'bg-info/10 border-info/20', text: 'text-info' },
    user: { label: 'Độc giả', bg: 'bg-muted border-border', text: 'text-muted-foreground' },
  }

  const currentRole = roleLabels[user.role] || roleLabels.user

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8 pb-8">
        {/* Profile Hero Header Banner */}
        <div className="relative mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          {/* Decorative Cover Gradient */}
          <div className="h-32 sm:h-40 w-full bg-gradient-to-r from-primary via-primary to-accent relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-black/20" />
            <div className="absolute -bottom-6 -right-6 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="absolute top-4 left-6 flex items-center gap-2 rounded-full bg-black/25 backdrop-blur-md px-3.5 py-1 text-xs font-medium text-white shadow-sm">
              <UserIcon className="h-3.5 w-3.5 text-link" />
              <span>Hồ sơ cá nhân</span>
            </div>
          </div>

          {/* Profile User Info Content */}
          <div className="px-6 pb-6 pt-0">
            {/* Top row with floating avatar and action/status badges */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              {/* Avatar floating over banner */}
              <div className="-mt-14 sm:-mt-16 relative">
                <div className="relative inline-block group">
                  <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full border-4 border-card bg-background overflow-hidden shadow-xl ring-2 ring-primary/20">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt={user.displayName}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary/10 text-4xl font-extrabold text-link">
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {isUpdatingAvatar && (
                      <div role="status" className="absolute inset-0 flex items-center justify-center bg-black/50 text-white backdrop-blur-xs">
                        <div aria-hidden="true" className="h-7 w-7 animate-spin rounded-full border-3 border-white border-t-transparent" />
                        <span className="sr-only">Đang cập nhật ảnh đại diện…</span>
                      </div>
                    )}
                  </div>

                  {/* Camera Icon Trigger */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUpdatingAvatar}
                    className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-card)] hover:bg-primary-hover transition-transform active:scale-95 border-2 border-card cursor-pointer"
                    title="Đổi ảnh đại diện"
                    aria-label="Đổi ảnh đại diện"
                  >
                    <Camera className="h-4 w-4" />
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/png, image/jpeg, image/webp, image/gif"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Status Chips aligned on right */}
              <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 sm:mb-2">
                {user.isEmailVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 border border-success/20 px-3 py-1 text-xs font-semibold text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Email đã xác thực
                  </span>
                ) : (
                  <Link
                    to="/verify-email"
                    className="inline-flex items-center gap-1 rounded-full bg-warning/10 border border-warning/20 px-3 py-1 text-xs font-semibold text-warning hover:bg-warning/20 transition-colors"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    Chưa xác thực email
                  </Link>
                )}

                {user.role === 'author' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-link">
                    <Feather className="h-3.5 w-3.5" />
                    Tác giả chính thức
                  </span>
                ) : null}
              </div>
            </div>

            {/* Name, Username & Role below avatar */}
            <div className="mt-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="min-w-0 break-words [overflow-wrap:anywhere] text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{user.displayName}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-semibold ${currentRole.bg} ${currentRole.text}`}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {currentRole.label}
                </span>
              </div>
              <p className="break-words text-sm font-medium text-muted-foreground">@{user.username}</p>
            </div>

            {/* Bio Preview if exists */}
            {user.bio ? (
              <p className="mt-4 break-words text-sm text-foreground/80 bg-muted/40 rounded-2xl p-3.5 border border-border/60 leading-relaxed">
                "{user.bio}"
              </p>
            ) : null}
          </div>
        </div>

        {/* 2 Columns Grid: Author Banner + Settings Tabs */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Author Upgrade / Info Cards */}
          <div className="min-w-0 space-y-6">
            {/* Become Author Promo Card */}
            {user.role === 'user' && (
              <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-card to-surface-raised p-6 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-card)]">
                    <Feather className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-foreground">Trở thành Tác giả</h2>
                    <p className="text-xs text-muted-foreground">Sáng tác & đăng tải tác phẩm</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  Đăng ký quyền tác giả để bắt đầu xuất bản truyện, quản lý các chương và tương tác cùng hàng triệu độc giả.
                </p>

                {user.authorStatus === 'pending' ? (
                  <div className="rounded-md bg-warning/10 border border-warning/20 p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-warning">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>Đang chờ Admin phê duyệt</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Yêu cầu của bạn đang được xử lý sớm nhất.</p>
                    <Button asChild variant="link" className="mt-1">
                      <Link to={ROUTES.AUTHOR_APPLY}>Xem trạng thái đơn</Link>
                    </Button>
                  </div>
                ) : (
                  <Button
                    asChild
                    className="h-auto min-h-11 w-full gap-1.5 whitespace-normal font-semibold"
                  >
                    <Link to={ROUTES.AUTHOR_APPLY}>
                      <Feather className="h-4 w-4" />
                      Đăng ký làm tác giả
                    </Link>
                  </Button>
                )}
              </Card>
            )}

            {/* Quick Stats / Account Info Card */}
            <Card className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-foreground">Thông tin tài khoản</h2>
              <div className="space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Tên đăng nhập</span>
                  <span className="min-w-0 break-words font-semibold text-foreground">@{user.username}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Email</span>
                  <span className="min-w-0 break-all font-semibold text-foreground">{user.email}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Vai trò</span>
                  <span className="font-semibold capitalize text-link">{user.role}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5">
                  <span className="text-muted-foreground">Trạng thái bảo mật</span>
                  <span className="font-semibold text-success">Hoạt động bình thường</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Settings Tabs Card */}
          <div className="min-w-0 lg:col-span-2">
            <Card className="rounded-3xl border border-border bg-card shadow-md p-2 sm:p-6">
              <CardHeader className="px-3 pt-3 pb-4 sm:px-0 sm:pt-0">
                <h2 className="text-xl font-bold text-foreground">Cài đặt tài khoản</h2>
                <CardDescription className="text-sm text-muted-foreground">
                  Cập nhật thông tin cá nhân, mật khẩu và địa chỉ email của bạn
                </CardDescription>
              </CardHeader>

              <CardContent className="px-2 sm:px-0">
                <Tabs defaultValue="profile" className="w-full">
                  <TabsList aria-label="Cài đặt tài khoản" className="grid h-auto min-h-11 w-full grid-cols-3 rounded-full bg-muted p-1">
                    <TabsTrigger value="profile" className="min-w-0 rounded-full gap-1 px-2 sm:gap-1.5 sm:px-3 data-[state=active]:bg-card data-[state=active]:text-link data-[state=active]:shadow-sm">
                      <UserIcon aria-hidden="true" className="hidden h-4 w-4 sm:block" />
                      <span>Hồ sơ</span>
                    </TabsTrigger>
                    <TabsTrigger value="password" className="min-w-0 rounded-full gap-1 px-2 sm:gap-1.5 sm:px-3 data-[state=active]:bg-card data-[state=active]:text-link data-[state=active]:shadow-sm">
                      <KeyRound aria-hidden="true" className="hidden h-4 w-4 sm:block" />
                      <span>Mật khẩu</span>
                    </TabsTrigger>
                    <TabsTrigger value="email" className="min-w-0 rounded-full gap-1 px-2 sm:gap-1.5 sm:px-3 data-[state=active]:bg-card data-[state=active]:text-link data-[state=active]:shadow-sm">
                      <Mail aria-hidden="true" className="hidden h-4 w-4 sm:block" />
                      <span>Email</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Profile Tab */}
                  <TabsContent value="profile" className="space-y-4 pt-5">
                    <form onSubmit={handleProfileSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="displayName" required>
                          Tên hiển thị
                        </Label>
                        <Input
                          id="displayName"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Nhập tên hiển thị của bạn"
                          required
                          autoComplete="nickname"
                        />
                      </div>

                      <div>
                        <Label htmlFor="bio">Giới thiệu bản thân (Bio)</Label>
                        <textarea
                          id="bio"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Chia sẻ vài dòng ngắn gọn về sở thích, phong cách viết hoặc truyện yêu thích..."
                          rows={4}
                          className="min-h-32 w-full rounded-md border border-border bg-background px-4 py-3 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-[var(--shadow-sm)] transition-colors resize-y"
                        />
                      </div>

                      <Button type="submit" isLoading={isUpdatingProfile} className="font-semibold">
                        Lưu thay đổi hồ sơ
                      </Button>
                    </form>
                  </TabsContent>

                  {/* Password Tab */}
                  <TabsContent value="password" className="space-y-4 pt-5">
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="oldPassword" required>
                          Mật khẩu hiện tại
                        </Label>
                        <PasswordInput
                          id="oldPassword"
                          placeholder="••••••••"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          required
                          autoComplete="current-password"
                        />
                      </div>

                      <div>
                        <Label htmlFor="newPassword" required>
                          Mật khẩu mới
                        </Label>
                        <PasswordInput
                          id="newPassword"
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          error={passwordError}
                          required
                          autoComplete="new-password"
                          aria-describedby="profile-password-help"
                        />
                        <p id="profile-password-help" className="mt-1 px-3 text-xs text-muted-foreground">Mật khẩu mới phải có tối thiểu 6 ký tự</p>
                      </div>

                      <Button type="submit" isLoading={isChangingPassword} className="font-semibold mt-2">
                        Cập nhật mật khẩu
                      </Button>
                    </form>
                  </TabsContent>

                  {/* Email Tab */}
                  <TabsContent value="email" className="space-y-4 pt-5">
                    <div className="rounded-md bg-info/10 border border-info/20 p-4 text-sm space-y-1">
                      <p className="text-xs text-muted-foreground">Email đang liên kết với tài khoản:</p>
                      <p className="break-all font-bold text-foreground text-base">{user.email}</p>
                    </div>

                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="newEmail" required>
                          Địa chỉ Email mới
                        </Label>
                        <Input
                          id="newEmail"
                          type="email"
                          placeholder="nhap.email.moi@example.com"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          required
                          autoComplete="email"
                          aria-describedby="profile-email-help"
                        />
                        <p id="profile-email-help" className="mt-1 px-3 text-xs text-muted-foreground">
                          Email hiện tại chỉ thay đổi sau khi bạn xác nhận hộp thư mới. Liên kết có hiệu lực 30 phút; sau xác nhận bạn cần đăng nhập lại.
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="emailPassword" required>Mật khẩu hiện tại</Label>
                        <PasswordInput id="emailPassword" value={emailPassword}
                          onChange={event => setEmailPassword(event.target.value)}
                          required autoComplete="current-password" />
                      </div>
                      <Button type="submit" isLoading={isChangingEmail} className="font-semibold">
                        Gửi yêu cầu đổi Email
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default ProfilePage
