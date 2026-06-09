'use client'

import { Link } from '@/i18n/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, ShieldAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Public self-registration is intentionally disabled.
 *
 * Accounts are provisioned by an administrator or HR (via employee import /
 * magic-link invitations). Leaving open sign-up enabled would let anyone create
 * an account on a corporate HR tool. This page no longer calls supabase.auth.signUp.
 *
 * NOTE: Also disable "Allow new users to sign up" in the Supabase dashboard
 * (Authentication → Sign In / Providers → Email) to close the API-level vector.
 */
export default function SignupPage() {
  const t = useTranslations('Auth')

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <FileText className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
            {t('signupDisabled.title')}
          </CardTitle>
          <CardDescription>{t('signupDisabled.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">{t('signIn')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
