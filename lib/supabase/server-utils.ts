import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Tables } from '@/types/database'

type Profile = Tables<'profiles'>

export async function getCurrentProfile(): Promise<Profile | null> {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
        return null
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    if (profileError) {
        console.error('Error fetching profile:', profileError)
        return null
    }

    return profile
}

export async function requireAuth() {
    const profile = await getCurrentProfile()

    if (!profile) {
        redirect('/login')
    }

    return profile
}

export async function requireRole(allowedRoles: string[]) {
    const profile = await requireAuth()

    if (!allowedRoles.includes(profile.role)) {
        // If user has no access to this route, determine where they should go
        if (profile.role === 'employee') {
            redirect('/surveys')
        } else {
            redirect('/dashboard')
        }
    }

    return profile
}
