'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { FileText, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

const createLoginSchema = (t: (key: string) => string) => z.object({
  email: z.string().email(t('validation.emailInvalid')),
  password: z.string().min(6, t('validation.passwordLength')),
})

type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const t = useTranslations('Auth')
  const loginSchema = createLoginSchema(t)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginValues) => {
    setLoading(true)
    console.log('[Login] Attempting login...')

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        console.error('[Login] Auth error:', error)
        toast.error(error.message)
        return
      }

      console.log('[Login] Auth success, user:', authData.user?.id)

      // Fetch user profile to determine redirect destination
      let redirectPath = '/dashboard'
      if (authData.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single()

        console.log('[Login] Profile fetch:', profile?.role, profileError?.message)

        // Employees go to surveys, others go to dashboard
        if (profile?.role === 'employee') {
          redirectPath = '/surveys'
        }
      }

      console.log('[Login] Redirecting to:', redirectPath)
      toast.success(t('success'))
      // router.push automatically includes locale because it's from i18n/navigation
      router.push(redirectPath)
    } catch (err) {
      console.error('[Login] Unexpected error:', err)
      toast.error(t('error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <FileText className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl">{t('welcomeBack')}</CardTitle>
          <CardDescription>
            {t('signInSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('email')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t('emailPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('password')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t('passwordPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('submit')}
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            <Link
              href="/forgot-password"
              className="hover:text-primary underline-offset-4 hover:underline"
            >
              {t('forgotPassword')}
            </Link>
          </div>

          <div className="mt-6 text-center text-sm">
            {t('noAccount')}{' '}
            <Link
              href="/signup"
              className="text-primary underline-offset-4 hover:underline font-medium"
            >
              {t('signup')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
