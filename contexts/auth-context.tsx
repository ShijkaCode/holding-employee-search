'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database'

type Profile = Tables<'profiles'>

/**
 * Explicit auth state machine.
 *
 * Valid states and their meanings:
 * - UNINITIALIZED: Initial state, no checks performed yet
 * - CHECKING_SESSION: Actively checking if a session exists
 * - UNAUTHENTICATED: No valid session exists
 * - AUTHENTICATED_NO_PROFILE: Valid session, profile fetch in progress
 * - AUTHENTICATED_READY: Valid session, profile fetch complete (profile may be null)
 * - ERROR: An error occurred during auth initialization
 */
export type AuthState =
  | 'UNINITIALIZED'
  | 'CHECKING_SESSION'
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATED_NO_PROFILE'
  | 'AUTHENTICATED_READY'
  | 'ERROR'

interface AuthContextType {
  /** Current auth state machine state */
  authState: AuthState
  /** Supabase user object (null if unauthenticated) */
  user: User | null
  /** User profile from database (may be null even when authenticated) */
  profile: Profile | null
  /** Error message if authState is ERROR */
  error: string | null
  /** Sign out and redirect to login */
  signOut: () => Promise<void>

  // Computed helpers for common checks
  /** True when auth state is resolved and user is authenticated with profile loaded */
  isReady: boolean
  /** True when still determining auth state */
  isLoading: boolean
  /** True when definitively unauthenticated */
  isUnauthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>('UNINITIALIZED')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Memoize the supabase client so it doesn't get re-created on every render
  const [supabase] = useState(() => createClient())

  // Refs to track current values for use in callbacks (avoids stale closure issues)
  const authStateRef = useRef<AuthState>(authState)
  const userRef = useRef<User | null>(user)

  // Ref to prevent double initialization (survives StrictMode remounts)
  const hasInitializedRef = useRef(false)

  // Keep refs in sync with state
  useEffect(() => {
    authStateRef.current = authState
  }, [authState])

  useEffect(() => {
    userRef.current = user
  }, [user])

  /**
   * Fetch profile from database.
   * Returns null on error - profile fetch failures don't affect auth validity.
   */
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      console.log('[Auth] Fetching profile for:', userId)
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (fetchError) {
        console.error('[Auth] Profile fetch error:', fetchError.message)
        return null
      }
      console.log('[Auth] Profile loaded:', data?.role)
      return data
    } catch (err) {
      console.error('[Auth] Profile fetch exception:', err)
      return null
    }
  }, [supabase])

  /**
   * Handle authenticated user - set user and fetch profile.
   * This is the single path for both initial load and auth events.
   */
  const handleAuthenticated = useCallback(async (authenticatedUser: User) => {
    console.log('[Auth] Handling authenticated user:', authenticatedUser.id)

    // Set user immediately and transition to fetching profile
    setUser(authenticatedUser)
    setAuthState('AUTHENTICATED_NO_PROFILE')

    // Fetch profile - result doesn't affect auth validity
    const profileData = await fetchProfile(authenticatedUser.id)

    // Update profile (may be null) and mark as ready
    setProfile(profileData)
    setAuthState('AUTHENTICATED_READY')

    console.log('[Auth] Auth ready, profile:', profileData ? 'loaded' : 'null')
  }, [fetchProfile])

  /**
   * Handle unauthenticated state - clear all auth data.
   */
  const handleUnauthenticated = useCallback(() => {
    console.log('[Auth] Handling unauthenticated state')
    setUser(null)
    setProfile(null)
    setAuthState('UNAUTHENTICATED')
  }, [])

  useEffect(() => {
    let isMounted = true

    // Mark as checking session on mount
    if (!hasInitializedRef.current) {
      console.log('[Auth] Setting up auth listener...')
      setAuthState('CHECKING_SESSION')
    }

    /**
     * Set up auth state change listener.
     * INITIAL_SESSION is the source of truth for initial auth state (Supabase best practice).
     * Other events handle subsequent state changes.
     */
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        console.log('[Auth] Auth event:', event, session?.user?.id || 'no user')

        // Handle INITIAL_SESSION - this is the source of truth for initial state
        if (event === 'INITIAL_SESSION') {
          // Prevent double handling in StrictMode
          if (hasInitializedRef.current) {
            console.log('[Auth] Already initialized via INITIAL_SESSION, skipping...')
            return
          }
          hasInitializedRef.current = true

          if (session?.user) {
            console.log('[Auth] Initial session found, authenticating...')
            await handleAuthenticated(session.user)
          } else {
            console.log('[Auth] No initial session, marking unauthenticated...')
            handleUnauthenticated()
          }
          return
        }

        // Handle sign out explicitly
        if (event === 'SIGNED_OUT') {
          handleUnauthenticated()
          router.refresh()
          return
        }

        // Handle sign in - user explicitly signed in (after initial load)
        if (event === 'SIGNED_IN' && session?.user) {
          // Only handle if we're in a state where this is expected
          // Use ref to get current state value (avoids stale closure)
          const currentState = authStateRef.current
          if (currentState === 'UNAUTHENTICATED' || currentState === 'ERROR') {
            await handleAuthenticated(session.user)
            router.refresh()
          }
          return
        }

        // Handle token refresh - just update the user object if needed
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Use ref to get current user (avoids stale closure)
          const currentUser = userRef.current
          if (currentUser?.id === session.user.id) {
            // Same user, just update user object in case it changed
            setUser(session.user)
          }
          return
        }

        // Handle user updated event
        if (event === 'USER_UPDATED' && session?.user) {
          setUser(session.user)
          // Optionally re-fetch profile if user data changed significantly
          // Use ref to get current state (avoids stale closure)
          const currentState = authStateRef.current
          if (currentState === 'AUTHENTICATED_READY') {
            const profileData = await fetchProfile(session.user.id)
            if (isMounted) setProfile(profileData)
          }
          return
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run on mount

  /**
   * Sign out handler - clears state and redirects.
   */
  const signOut = useCallback(async () => {
    console.log('[Auth] Signing out...')
    try {
      await supabase.auth.signOut()
      // State will be cleared by onAuthStateChange handler
      router.push('/login')
    } catch (err) {
      console.error('[Auth] Sign out error:', err)
      // Force clear state even on error
      handleUnauthenticated()
      router.push('/login')
    }
  }, [supabase, router, handleUnauthenticated])

  // Compute helper values
  const isReady = authState === 'AUTHENTICATED_READY'
  const isLoading = authState === 'UNINITIALIZED' ||
                    authState === 'CHECKING_SESSION' ||
                    authState === 'AUTHENTICATED_NO_PROFILE'
  const isUnauthenticated = authState === 'UNAUTHENTICATED'

  const value: AuthContextType = {
    authState,
    user,
    profile,
    error,
    signOut,
    isReady,
    isLoading,
    isUnauthenticated,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to access auth context.
 * Must be used within an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Backwards compatibility: derive loading from state machine.
 * @deprecated Use authState or isLoading instead
 */
export function useAuthLoading() {
  const { isLoading } = useAuth()
  return isLoading
}
