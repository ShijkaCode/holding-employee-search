import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware';

const handleI18n = createMiddleware({
  locales: ['en', 'mn'], // A list of all locales that are supported
  defaultLocale: 'en', // Used when no locale matches
  localePrefix: 'always' // Always include locale prefix for consistency
});

export async function middleware(request: NextRequest) {
  // 1. Run next-intl middleware first to handle redirects/rewrites and locale resolution
  const response = handleI18n(request);

  // 2. Pass the response to Supabase middleware to maintain session and handle auth guards
  return await updateSession(request, response)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (if any)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
