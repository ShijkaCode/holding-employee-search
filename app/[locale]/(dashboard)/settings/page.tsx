'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { User, Mail, Building2, Briefcase } from 'lucide-react'

import { useTranslations } from 'next-intl'

// Schema moved inside component to use translations

export default function SettingsPage() {
  const { user, profile } = useAuth()
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const t = useTranslations('Settings')

  const profileSchema = z.object({
    full_name: z.string().min(2, t('nameValidation')),
    department: z.string().optional(),
  })

  type ProfileFormValues = z.infer<typeof profileSchema>

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || '',
      department: profile?.department || '',
    },
  })

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return

    setSaving(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          department: data.department || null,
        })
        .eq('id', user.id)

      if (error) throw error
      toast.success(t('successMessage'))
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error(t('errorMessage'))
    } finally {
      setSaving(false)
    }
  }

  const initials = profile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'U'

  return (
    <div className="page-container max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {t('subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">{t('profile')}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t('profileDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Avatar className="h-14 w-14 sm:h-20 sm:w-20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-lg sm:text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-sm sm:text-base">{profile?.full_name}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground capitalize">
                {profile?.role}
              </p>
            </div>
          </div>

          <Separator />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fullName')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>{t('email')}</FormLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    value={profile?.email || user?.email || ''}
                    disabled
                  />
                </div>
                <FormDescription>
                  {t('emailDesc')}
                </FormDescription>
              </div>

              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('department')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-10" placeholder={t('departmentPlaceholder')} {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={saving}>
                {saving ? t('saving') : t('saveChanges')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('accountInfo')}</CardTitle>
          <CardDescription>
            {t('accountInfoDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('role')}</p>
              <p className="font-medium capitalize">{profile?.role}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('employeeId')}</p>
              <p className="font-medium">{profile?.employee_id || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
