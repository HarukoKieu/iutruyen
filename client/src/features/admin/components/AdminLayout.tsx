import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Users,
  PenTool,
  ShieldCheck,
  BookOpen,
  Settings,
  FileText,
  Database,
  ShieldAlert,
  Home,
  Menu,
  X,
  ChevronRight,
  Shield,
  Activity,
  User as UserIcon,
  ExternalLink,
} from 'lucide-react'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'
import ThemeToggle from '@/components/layout/ThemeToggle'
import { Badge } from '@/components/ui/badge'
import type { User } from '@/types/user'
import { adminError } from '../hooks/useAdmin'

interface AdminNavLink {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const navSections: { title: string; links: AdminNavLink[] }[] = [
  {
    title: 'Tổng quan',
    links: [
      { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
    ],
  },
  {
    title: 'Quản lý người dùng',
    links: [
      { to: '/admin/users', label: 'Người dùng', icon: Users },
      { to: '/admin/authors', label: 'Tác giả', icon: PenTool },
      { to: '/admin/moderators', label: 'Kiểm duyệt viên', icon: ShieldCheck },
    ],
  },
  {
    title: 'Hệ thống & Dữ liệu',
    links: [
      { to: '/admin/stories', label: 'Truyện', icon: BookOpen },
      { to: '/admin/config', label: 'Cấu hình', icon: Settings },
      { to: '/admin/audit', label: 'Audit', icon: FileText },
      { to: '/admin/backups', label: 'Backup', icon: Database },
    ],
  },
]

export default function AdminLayout() {
  const user = useAuthStore(state => state.user)
  const setUser = useAuthStore(state => state.setUser)
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const identity = useQuery({
    queryKey: ['admin', user?.id, 'identity'],
    queryFn: async ({ signal }) =>
      (await api.get<{ data: User }>('/users/me', { signal, timeout: 10000 })).data.data,
    refetchInterval: 30000,
    refetchOnWindowFocus: 'always',
    staleTime: 0,
    retry: false,
  })

  useEffect(() => {
    if (identity.data) setUser(identity.data)
  }, [identity.data, setUser])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Accessibility for mobile drawer
  useModalAccessibility({
    open: mobileOpen,
    onClose: () => setMobileOpen(false),
    containerRef: drawerRef,
    initialFocusRef: closeButtonRef,
  })

  // Determine current page title for breadcrumb
  const currentLink = navSections
    .flatMap(section => section.links)
    .find(link => (link.end ? location.pathname === link.to : location.pathname.startsWith(link.to)))

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row">
      {/* Skip to content accessibility link */}
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-md"
      >
        Chuyển đến nội dung chính
      </a>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          data-modal-backdrop="true"
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Desktop + Mobile Drawer) */}
      <aside
        ref={drawerRef}
        id="admin-sidebar"
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen || undefined}
        aria-label="Thanh điều hướng quản trị"
        className={`fixed inset-y-0 left-0 z-50 w-72 flex-col justify-between border-r border-border bg-card transition-transform duration-200 ease-in-out lg:static lg:flex lg:w-64 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 flex shadow-2xl' : '-translate-x-full hidden'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Sidebar Header */}
          <div className="flex h-16 items-center justify-between border-b border-border px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-raised text-foreground border border-border">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-serif font-bold text-base leading-tight">iutruyen</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                  Hệ thống Quản trị
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px] uppercase font-semibold text-muted-foreground border-border bg-surface-raised">
                    Admin
                  </Badge>
                </span>
              </div>
            </div>
            {mobileOpen && (
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-raised hover:text-foreground lg:hidden"
                aria-label="Đóng thanh điều hướng"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav aria-label="Quản trị" className="flex-1 space-y-6 px-3 py-4">
            {navSections.map(section => (
              <div key={section.title} className="space-y-1">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.links.map(link => {
                    const Icon = link.icon
                    return (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.end}
                        className={({ isActive }) =>
                          `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                            isActive
                              ? 'bg-secondary text-link font-semibold shadow-2xs'
                              : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              className={`h-4 w-4 shrink-0 transition-colors ${
                                isActive
                                  ? 'text-link'
                                  : 'text-muted-foreground group-hover:text-foreground'
                              }`}
                            />
                            <span className="flex-1 truncate">{link.label}</span>
                          </>
                        )}
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Quick External Actions Section */}
            <div className="space-y-1 border-t border-border pt-4">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Lối tắt
              </p>
              <div className="space-y-0.5">
                <NavLink
                  to="/mod"
                  className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-all"
                >
                  <ShieldAlert className="h-4 w-4 text-sky-500 group-hover:text-sky-600 shrink-0" />
                  <span className="flex-1 truncate">Kiểm duyệt nội dung</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </NavLink>
                <NavLink
                  to="/"
                  className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-all"
                >
                  <Home className="h-4 w-4 text-emerald-500 group-hover:text-emerald-600 shrink-0" />
                  <span className="flex-1 truncate">Về trang chủ</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </NavLink>
              </div>
            </div>
          </nav>
        </div>

        {/* Sidebar Footer with Current Admin User */}
        <div className="border-t border-border p-3.5 bg-surface-raised/40">
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-raised text-foreground font-bold text-xs uppercase border border-border shadow-2xs">
              {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : <UserIcon className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-foreground">
                {user?.displayName || 'Admin'}
              </p>
              <p className="truncate text-xs text-muted-foreground font-mono">
                @{user?.username || 'admin'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/85 px-4 sm:px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-surface-raised hover:text-foreground lg:hidden"
              aria-controls="admin-sidebar"
              aria-expanded={mobileOpen}
              aria-label="Mở menu quản trị"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Quản trị</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
              <span className="text-foreground font-semibold truncate">
                {currentLink?.label || 'Bảng điều khiển'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick System Status Chip */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border bg-surface-raised/60 px-3 py-1 text-xs text-muted-foreground font-medium">
              <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
              <span>Hệ thống sẵn sàng</span>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>
        </header>

        {/* Content Body */}
        <main id="admin-main" className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-border/60">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">
                Quản trị hệ thống
              </h1>
              <p className="text-sm text-muted-foreground">
                Hệ sinh thái vận hành, giám sát phân quyền, nội dung và hạ tầng dữ liệu
              </p>
            </div>
          </div>

          {identity.isPending ? (
            <div role="status" className="flex items-center gap-3 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-xs">
              <div aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Đang kiểm tra quyền hiện tại…</span>
            </div>
          ) : identity.isError ? (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive shadow-xs">
              <p className="font-semibold mb-1">Lỗi xác thực quyền quản trị</p>
              <p>{adminError(identity.error)}</p>
            </div>
          ) : identity.data.role !== 'admin' ? (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive shadow-xs">
              <p className="font-semibold mb-1">Truy cập bị từ chối</p>
              <p>Quyền admin đã bị thu hồi.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

