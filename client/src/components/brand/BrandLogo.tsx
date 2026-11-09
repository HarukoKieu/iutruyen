import React from 'react'
import { Link } from 'react-router-dom'
import logoImage from '@/assets/branding/iutruyen-logo-transparent.png'

export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'full' | 'icon-only' | 'text-only'
  showTagline?: boolean
  className?: string
  asLink?: boolean
  href?: string
}

// Frame the original PNG's artwork without its large presentation margins.
// All variants share the same image, keeping the approved icon and lettering.
const logoFrames = {
  full: '80 155 2040 430',
  'icon-only': '80 155 665 430',
  'text-only': '760 240 1360 335',
}

const logoSizes = {
  full: {
    sm: 'h-6 w-[120px] sm:h-7 sm:w-[136px]',
    md: 'h-6 w-[120px] sm:h-8 sm:w-[144px]',
    lg: 'h-10 w-[192px]',
    xl: 'h-14 w-[272px]',
  },
  'icon-only': {
    sm: 'h-7 w-11',
    md: 'h-8 w-12',
    lg: 'h-10 w-16',
    xl: 'h-14 w-[88px]',
  },
  'text-only': {
    sm: 'h-6 w-[100px]',
    md: 'h-7 w-[116px]',
    lg: 'h-8 w-[132px]',
    xl: 'h-12 w-[196px]',
  },
}

/** The selected book-heart image and IuTruyen wordmark, shared across the app. */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  variant = 'full',
  showTagline = false,
  className = '',
  asLink = true,
  href = '/',
}) => {
  const content = (
    <span className={`inline-flex shrink-0 flex-col items-start gap-1 ${className}`}>
      <svg
        viewBox={logoFrames[variant]}
        xmlns="http://www.w3.org/2000/svg"
        className={`block shrink-0 overflow-hidden [.dark_&]:[filter:invert(1)_hue-rotate(180deg)] ${logoSizes[variant][size]}`}
        role={asLink ? undefined : 'img'}
        aria-label={asLink ? undefined : 'IuTruyen'}
        aria-hidden={asLink ? true : undefined}
        focusable="false"
      >
        <image href={logoImage} width="2172" height="724" />
      </svg>
      {showTagline && variant !== 'icon-only' && (
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground tracking-wider uppercase">
          Không gian truyện chữ
        </span>
      )}
    </span>
  )

  if (asLink) {
    return (
      <Link
        to={href}
        className="inline-flex shrink-0 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="IuTruyen - Trang chủ"
      >
        {content}
      </Link>
    )
  }

  return content
}

export default BrandLogo
