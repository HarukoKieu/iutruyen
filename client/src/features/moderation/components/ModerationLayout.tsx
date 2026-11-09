import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'
import { useModerationSummary } from '../hooks/useModeration'

function BadgeCount({ count }: { count?: number }) {
  if (!count) return null
  return (
    <span className="mod-nav-badge">{count > 99 ? '99+' : count}</span>
  )
}

export function ModerationLayout() {
  const { data: summary } = useModerationSummary()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useModalAccessibility({ open: isMenuOpen, onClose: () => setIsMenuOpen(false), containerRef: menuRef, initialFocusRef: closeRef })
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    const handleChange = () => { if (query.matches) setIsMenuOpen(false) }
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  const navItems = [
    {
      to: '/mod/stories',
      label: 'Duyệt Truyện',
      icon: '📚',
      badge: summary?.pendingStories,
      id: 'mod-nav-stories',
    },
    {
      to: '/mod/chapters',
      label: 'Duyệt Chương',
      icon: '📄',
      badge: summary?.pendingChapters,
      id: 'mod-nav-chapters',
    },
    {
      to: '/mod/comments',
      label: 'Kiểm Duyệt BL',
      icon: '💬',
      badge: summary?.spamComments,
      id: 'mod-nav-comments',
    },
    {
      to: '/mod/reports',
      label: 'Báo Cáo',
      icon: '🚨',
      badge: summary?.pendingReports,
      id: 'mod-nav-reports',
    },
    {
      to: '/mod/history',
      label: 'Lịch Sử',
      icon: '📋',
      badge: undefined,
      id: 'mod-nav-history',
    },
  ]

  return (
    <div className="mod-layout">
      <header className="mod-mobile-header">
        <button type="button" className="btn-mod-outline" aria-controls="moderation-sidebar" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen(true)}>☰ Menu kiểm duyệt</button>
      </header>
      <div ref={menuRef} id="moderation-sidebar" className={`mod-sidebar-container${isMenuOpen ? ' is-open' : ''}`} role={isMenuOpen ? 'dialog' : undefined} aria-modal={isMenuOpen || undefined} aria-label="Menu kiểm duyệt">
      {isMenuOpen && <button type="button" className="mod-sidebar-overlay" tabIndex={-1} aria-label="Đóng menu kiểm duyệt" onClick={() => setIsMenuOpen(false)} />}
      {/* Sidebar */}
      <aside className={`mod-sidebar${isMenuOpen ? ' is-open' : ''}`} aria-label="Menu kiểm duyệt">
        <button ref={closeRef} type="button" className="mod-sidebar-close mod-modal-close" aria-label="Đóng menu kiểm duyệt" onClick={() => setIsMenuOpen(false)}>✕</button>
        <div className="mod-sidebar-header">
          <div className="mod-sidebar-logo">
            <span className="mod-sidebar-logo-icon">🛡️</span>
            <div>
              <div className="mod-sidebar-title">Kiểm Duyệt</div>
              <div className="mod-sidebar-subtitle">Moderator Dashboard</div>
            </div>
          </div>

          {summary && (
            <div className="mod-summary-card">
              <div className="mod-summary-item">
                <span className="mod-summary-dot pending" />
                <span>Chờ duyệt</span>
                <strong>{summary.totalPending}</strong>
              </div>
              <div className="mod-summary-item">
                <span className="mod-summary-dot report" />
                <span>Báo cáo mới</span>
                <strong>{summary.pendingReports}</strong>
              </div>
            </div>
          )}
        </div>

        <nav className="mod-nav" aria-label="Moderation Navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              id={item.id}
              aria-label={item.label}
              title={item.label}
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) =>
                `mod-nav-link${isActive ? ' active' : ''}`
              }
            >
              <span className="mod-nav-icon">{item.icon}</span>
              <span className="mod-nav-label">{item.label}</span>
              <BadgeCount count={item.badge} />
            </NavLink>
          ))}
        </nav>

        <div className="mod-sidebar-footer">
          <a href="/" className="mod-sidebar-back" id="mod-back-home">
            ← Về trang chủ
          </a>
        </div>
      </aside>
      </div>

      {/* Main Content */}
      <main className="mod-main">
        <Outlet />
      </main>
    </div>
  )
}

export default ModerationLayout

