import React from 'react'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { MobileNav } from './MobileNav'
import AdSlot from '@/components/common/AdSlot'
import SiteAnnouncement from '@/components/common/SiteAnnouncement'

interface AppLayoutProps {
  children: React.ReactNode
  hideFooter?: boolean
  hideNavbar?: boolean
  showAds?: boolean
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  hideFooter = false,
  hideNavbar = false,
  showAds = false,
}) => {
  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background text-foreground transition-colors selection:bg-primary/25 selection:text-foreground pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
      <a href="#main-content" className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-card p-3 font-semibold text-foreground shadow-lg focus:not-sr-only">Bỏ qua điều hướng</a>
      {!hideNavbar && <Navbar />}
      {!hideNavbar && <SiteAnnouncement />}
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
        {showAds && <AdSlot placement="site-banner" className="my-6 px-4 sm:px-6 lg:px-8" />}
        {children}
      </main>
      {!hideFooter && <Footer />}
      <MobileNav />
    </div>
  )
}

export default AppLayout
