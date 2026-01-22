import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/supabase/server-utils'

export async function DashboardGuard({ children }: { children: React.ReactNode }) {
    const profile = await getCurrentProfile()

    if (!profile) {
        redirect('/login')
    }

    // We rely on middleware.ts for granular role-based access control (RBAC).
    // This guard primarily ensures the user is authenticated and has a profile
    // before rendering the dashboard layout.

    return <>{children}</>
}
