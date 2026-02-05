import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest, response?: NextResponse) {
  let supabaseResponse = response ?? NextResponse.next({
    request,
  })

  // Start logic to strip locale to understand paths
  const pathname = request.nextUrl.pathname

  // Assuming defined locales are en|mn. Modify this regex if locales change.
  const localePattern = /^\/(en|mn)/;
  const localeMatch = pathname.match(localePattern);
  const localePrefix = localeMatch ? localeMatch[0] : '';
  // pathWithoutLocale removes /en or /mn from start. 
  // e.g. /en/login -> /login, /en -> /
  const pathWithoutLocale = pathname.replace(localePattern, '') || '/';


  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // If we created a fresh response, update it
          if (!response) {
            supabaseResponse = NextResponse.next({
              request,
            })
          }
          // If response was passed in, we mutate it (NextResponse is mutable-ish regarding cookies?)
          // actually NextResponse.cookies.set returns the response, but the object itself holds state.
          // Careful: if we replace 'supabaseResponse', we might lose previous headers.
          // Standard pattern:
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/forgot-password', '/auth/callback', '/auth/magic-link']
  const isPublicRoute = publicRoutes.some(route => pathWithoutLocale.startsWith(route))

  // If user is not logged in and trying to access protected route
  if (!user && !isPublicRoute && pathWithoutLocale !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = `${localePrefix}/login`
    return NextResponse.redirect(url)
  }

  // If user is logged in
  if (user) {
    // 1. Redirect away from auth pages
    if (isPublicRoute) {
      const url = request.nextUrl.clone()
      // Redirect to root logic
      url.pathname = `${localePrefix}/`
      return NextResponse.redirect(url)
    }

    // 2. Fetch profile to determine role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'employee' // Default to employee if unknown

    // 3. Root Path Redirection
    if (pathWithoutLocale === '/') {
      const url = request.nextUrl.clone()
      if (role === 'employee') {
        url.pathname = `${localePrefix}/surveys`
      } else {
        url.pathname = `${localePrefix}/dashboard`
      }
      return NextResponse.redirect(url)
    }

    // 4. Protect Admin/HR Routes from Employees
    if (role === 'employee') {
      const forbiddenPrefixes = ['/dashboard', '/forms', '/admin']
      const isForbidden = forbiddenPrefixes.some(prefix => pathWithoutLocale.startsWith(prefix))

      if (isForbidden) {
        const url = request.nextUrl.clone()
        url.pathname = `${localePrefix}/surveys`
        return NextResponse.redirect(url)
      }
    }

    // 5. Protect Admin Routes (if any specific /admin routes exist)
    if (pathWithoutLocale.startsWith('/admin') && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = role === 'employee' ? `${localePrefix}/surveys` : `${localePrefix}/dashboard`
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
