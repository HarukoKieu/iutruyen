import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import type { ReactNode } from 'react'
import MatureConfirmationProvider from '../components/MatureConfirmationProvider'
import { useMatureConfirmation } from './useMatureConfirmation'

const wrapper = ({ children }: { children: ReactNode }) => <MatureConfirmationProvider>{children}</MatureConfirmationProvider>
function Probe() {
  const { isConfirmed } = useMatureConfirmation('a')
  return <p>{isConfirmed ? 'confirmed' : 'unconfirmed'}</p>
}

describe('explicit mature consent with optional session persistence', () => {
  beforeEach(() => { sessionStorage.clear() })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear() })

  it.each(['object', 'read', 'write'] as const)('requires explicit consent and survives denied storage %s', failure => {
    if (failure === 'object') vi.stubGlobal('sessionStorage', { getItem() { throw new DOMException('Denied', 'SecurityError') }, setItem() { throw new DOMException('Denied', 'SecurityError') } })
    if (failure === 'read') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError') })
    if (failure === 'write') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota', 'QuotaExceededError') })
    const hook = renderHook(() => ({ first: useMatureConfirmation('a'), second: useMatureConfirmation('b') }), { wrapper })
    expect(hook.result.current.first.isConfirmed).toBe(false)
    expect(hook.result.current.second.isConfirmed).toBe(false)
    act(() => hook.result.current.first.confirm())
    expect(hook.result.current.first.isConfirmed).toBe(true)
    expect(hook.result.current.second.isConfirmed).toBe(false)
  })
  it('contains errors from accessing the sessionStorage property itself', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError') })
    const hook = renderHook(() => useMatureConfirmation('a'), { wrapper })
    expect(hook.result.current.isConfirmed).toBe(false)
    act(() => hook.result.current.confirm())
    expect(hook.result.current.isConfirmed).toBe(true)
  })
  it('shares consent between consumers and when navigating away/back to the same story', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    const hook = renderHook(({ id }) => ({ route: useMatureConfirmation(id), reader: useMatureConfirmation(id) }), { initialProps: { id: 'a' }, wrapper })
    act(() => hook.result.current.route.confirm())
    expect(hook.result.current.reader.isConfirmed).toBe(true)
    hook.rerender({ id: 'b' })
    expect(hook.result.current.reader.isConfirmed).toBe(false)
    hook.rerender({ id: 'a' })
    expect(hook.result.current.reader.isConfirmed).toBe(true)
  })
  it('restores the existing storage key only for the matching story', () => {
    sessionStorage.setItem('mature_confirmed_a', '1')
    const hook = renderHook(() => ({ first: useMatureConfirmation('a'), second: useMatureConfirmation('b') }), { wrapper })
    expect(hook.result.current.first.isConfirmed).toBe(true)
    expect(hook.result.current.second.isConfirmed).toBe(false)
  })
  it.each(['true', '0', 'corrupt'])('does not interpret %s as persisted consent', value => {
    sessionStorage.setItem('mature_confirmed_a', value)
    const hook = renderHook(() => useMatureConfirmation('a'), { wrapper })
    expect(hook.result.current.isConfirmed).toBe(false)
  })
  it('requires confirmation again in a new app when persistence is denied', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied') })
    const first = renderHook(() => useMatureConfirmation('a'), { wrapper })
    act(() => first.result.current.confirm())
    expect(first.result.current.isConfirmed).toBe(true)
    const second = renderHook(() => useMatureConfirmation('a'), { wrapper })
    expect(second.result.current.isConfirmed).toBe(false)
  })
  it('never restores browser consent during SSR or shares state between app requests', () => {
    sessionStorage.setItem('mature_confirmed_a', '1')
    const read = vi.spyOn(Storage.prototype, 'getItem')
    expect(renderToString(wrapper({ children: <Probe /> }))).toContain('unconfirmed')
    expect(renderToString(wrapper({ children: <Probe /> }))).toContain('unconfirmed')
    expect(read).not.toHaveBeenCalled()
  })
  it('does not confirm an unknown/empty story identity', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const hook = renderHook(() => useMatureConfirmation(''), { wrapper })
    act(() => hook.result.current.confirm())
    expect(hook.result.current.isConfirmed).toBe(false)
    expect(write).not.toHaveBeenCalled()
  })
})
