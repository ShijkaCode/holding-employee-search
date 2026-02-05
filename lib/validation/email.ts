/**
 * Email Validation Utilities
 * Includes format validation and MX record lookup
 */

// RFC 5322 Email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

/**
 * Validate email format using RFC 5322
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  if (email.length > 254) return false // Max email length
  return EMAIL_REGEX.test(email)
}

/**
 * Extract domain from email
 */
export function extractDomain(email: string): string | null {
  const parts = email.split('@')
  return parts.length === 2 ? parts[1].toLowerCase() : null
}

/**
 * Check if domain has valid MX records (server-side only)
 * This must be called from API routes, not client-side
 */
export async function hasMXRecords(domain: string): Promise<boolean> {
  // Client-side check - return true (validation happens server-side)
  if (typeof window !== 'undefined') {
    return true
  }

  try {
    // Server-side MX lookup using Node.js dns module
    const dns = await import('dns')
    const { promisify } = await import('util')
    const resolveMx = promisify(dns.default.resolveMx)

    const addresses = await resolveMx(domain)
    return addresses && addresses.length > 0
  } catch (error) {
    // DNS lookup failed - domain might not exist or no MX records
    console.warn(`MX lookup failed for domain ${domain}:`, error)
    return false
  }
}

/**
 * Validate email comprehensively (format + MX)
 * For server-side use only
 */
export async function validateEmail(email: string): Promise<{
  valid: boolean
  error?: string
}> {
  // Check format
  if (!isValidEmailFormat(email)) {
    return { valid: false, error: 'Invalid email format' }
  }

  // Extract domain
  const domain = extractDomain(email)
  if (!domain) {
    return { valid: false, error: 'Invalid email domain' }
  }

  // Check MX records (server-side only)
  if (typeof window === 'undefined') {
    const hasMX = await hasMXRecords(domain)
    if (!hasMX) {
      return { valid: false, error: 'Domain does not accept emails (no MX records)' }
    }
  }

  return { valid: true }
}

/**
 * Validate batch of emails efficiently
 * Groups by domain to minimize DNS lookups
 */
export async function validateEmails(emails: string[]): Promise<Map<string, { valid: boolean; error?: string }>> {
  const results = new Map<string, { valid: boolean; error?: string }>()
  const domainCache = new Map<string, boolean>()

  for (const email of emails) {
    // Check format first
    if (!isValidEmailFormat(email)) {
      results.set(email, { valid: false, error: 'Invalid email format' })
      continue
    }

    const domain = extractDomain(email)
    if (!domain) {
      results.set(email, { valid: false, error: 'Invalid email domain' })
      continue
    }

    // Check domain MX (with caching)
    if (typeof window === 'undefined') {
      let hasMX = domainCache.get(domain)
      if (hasMX === undefined) {
        hasMX = await hasMXRecords(domain)
        domainCache.set(domain, hasMX)
      }

      if (!hasMX) {
        results.set(email, { valid: false, error: 'Domain does not accept emails' })
        continue
      }
    }

    results.set(email, { valid: true })
  }

  return results
}

/**
 * Phone number validation (E.164 format)
 * For Phase 4 SMS implementation
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false

  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '')

  // E.164 format: +[country code][number]
  // Must start with +, total length 8-15 digits
  const e164Regex = /^\+[1-9]\d{7,14}$/

  return e164Regex.test(cleaned)
}

/**
 * Normalize phone number to E.164 format
 */
export function normalizePhoneNumber(phone: string, defaultCountryCode: string = '+976'): string {
  if (!phone) return ''

  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '')

  // If no country code, add default (Mongolia +976)
  if (!cleaned.startsWith('+')) {
    cleaned = defaultCountryCode + cleaned
  }

  return cleaned
}
