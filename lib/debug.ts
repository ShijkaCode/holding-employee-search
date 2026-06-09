// Dev-only console wrapper. No-ops in production builds. Safe in both
// client and server code because Next.js inlines NODE_ENV at build time.
const isDev = process.env.NODE_ENV !== 'production'

export const debugLog = (...args: unknown[]): void => {
  if (isDev) console.log(...args)
}

export const debugWarn = (...args: unknown[]): void => {
  if (isDev) console.warn(...args)
}
