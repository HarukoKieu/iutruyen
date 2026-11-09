import { createContext } from 'react'
/** Freeze relative labels across SSR and the first browser render. */
export const RenderClock = createContext(0)
