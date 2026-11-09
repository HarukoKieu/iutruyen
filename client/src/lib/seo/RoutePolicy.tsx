import { useLocation } from 'react-router-dom'
import { useSeoHead } from '@/hooks/useSeoHead'
import { fallbackMeta } from './publicPage'
/** Client-only routes must clear all previous resource metadata. */
export function PrivateRoutePolicy() {
  const location = useLocation()
  useSeoHead({ ...fallbackMeta(), title: `iutruyen — ${location.pathname.startsWith('/author') ? 'Tác giả' : 'Tài khoản'}` })
  return null
}
