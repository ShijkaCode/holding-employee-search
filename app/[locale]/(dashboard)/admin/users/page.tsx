'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Pencil, Search, Building2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Profile {
  id: string
  full_name: string
  email: string | null
  role: string
  company_id: string | null
  department: string | null
  org_unit_id: string | null
  employee_id: string | null
  avatar_url: string | null
  company?: { name: string } | null
  org_path?: string | null
}

interface Company {
  id: string
  name: string
}

interface OrgUnit {
  id: string
  name: string
  path_names: string
  level_depth: number
  company_id: string
}

const profileSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  role: z.enum(['admin', 'hr', 'specialist', 'employee']),
  company_id: z.string().optional(),
  org_unit_id: z.string().nullable().optional(),
  employee_id: z.string().optional(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const t = useTranslations('Admin.users')
  const tCommon = useTranslations('Common')

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)

    const [profilesRes, companiesRes, orgUnitsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, company:companies(name)')
        .order('full_name'),
      supabase.from('companies').select('id, name').order('name'),
      (supabase as any)
        .from('org_hierarchy')
        .select('id, name, path_names, level_depth, company_id')
        .order('path_names'),
    ])

    // Build a map of org_unit_id to path_names
    const pathMap = new Map<string, string>()
    orgUnitsRes.data?.forEach((ou: { id: string | null; path_names: string | null }) => {
      if (ou.id && ou.path_names) {
        pathMap.set(ou.id, ou.path_names)
      }
    })

    const formattedProfiles = (profilesRes.data || []).map((p) => ({
      ...p,
      company: Array.isArray(p.company) ? p.company[0] : p.company,
      org_path: p.org_unit_id ? pathMap.get(p.org_unit_id) : null,
    }))

    // Filter valid org units
    const validOrgUnits: OrgUnit[] = []
    orgUnitsRes.data?.forEach((ou: { id: string | null; name: string | null; path_names: string | null; level_depth: number | null; company_id: string | null }) => {
      if (ou.id && ou.name && ou.path_names && ou.level_depth !== null && ou.company_id) {
        validOrgUnits.push({
          id: ou.id,
          name: ou.name,
          path_names: ou.path_names,
          level_depth: ou.level_depth,
          company_id: ou.company_id,
        })
      }
    })

    setProfiles(formattedProfiles)
    setCompanies(companiesRes.data || [])
    setOrgUnits(validOrgUnits)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openEditDialog = (profile: Profile) => {
    setEditingProfile(profile)
    form.reset({
      full_name: profile.full_name,
      role: profile.role as ProfileFormValues['role'],
      company_id: profile.company_id || '',
      org_unit_id: profile.org_unit_id || null,
      employee_id: profile.employee_id || '',
    })
    setShowDialog(true)
  }

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      role: 'employee',
      company_id: '',
      org_unit_id: null,
      employee_id: '',
    },
  })

  // Watch company_id to filter org units
  const selectedCompanyId = form.watch('company_id')

  // Filter org units by selected company
  const filteredOrgUnits = orgUnits.filter(
    (ou) => ou.company_id === selectedCompanyId
  )

  const onSubmit = async (data: ProfileFormValues) => {
    if (!editingProfile) return

    setSaving(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          role: data.role,
          company_id: data.company_id || null,
          org_unit_id: data.org_unit_id || null,
          employee_id: data.employee_id || null,
        })
        .eq('id', editingProfile.id)

      if (error) throw error
      toast.success(t('messages.updated'))
      setShowDialog(false)
      fetchData()
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error(t('messages.updateError'))
    } finally {
      setSaving(false)
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive'
      case 'hr':
        return 'default'
      case 'specialist':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const filteredProfiles = profiles.filter(
    (p) =>
      p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.org_path?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.department?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="page-container">
        <Skeleton className="h-8 w-24 sm:w-32" />
        <Skeleton className="h-64 sm:h-96" />
      </div>
    )
  }

  return (
    <div className="page-container">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {t('subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg">{t('allUsers')}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('registeredCount', { count: profiles.length })}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.user')}</TableHead>
                <TableHead>{t('table.role')}</TableHead>
                <TableHead>{t('table.company')}</TableHead>
                <TableHead>{t('table.department')}</TableHead>
                <TableHead className="w-[80px]">{tCommon('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback>
                          {profile.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{profile.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {profile.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(profile.role)}>
                      {t(`roles.${profile.role}` as 'roles.admin' | 'roles.hr' | 'roles.specialist' | 'roles.employee')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {profile.company?.name || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {profile.org_path ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{profile.org_path}</span>
                      </div>
                    ) : profile.department ? (
                      <span className="text-sm text-muted-foreground">
                        {profile.department}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(profile)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProfiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    {t('noUsers')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editUser')}</DialogTitle>
            <DialogDescription>
              {t('editDesc')}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.fullName')} *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.role')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                        <SelectItem value="hr">{t('roles.hr')}</SelectItem>
                        <SelectItem value="specialist">{t('roles.specialist')}</SelectItem>
                        <SelectItem value="employee">{t('roles.employee')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.company')}</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value)
                        // Clear org unit when company changes
                        form.setValue('org_unit_id', null)
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('fields.selectCompany')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">{t('fields.noCompany')}</SelectItem>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="org_unit_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.orgUnit')}</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === 'none' ? null : value)
                      }
                      value={field.value || 'none'}
                      disabled={!selectedCompanyId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('fields.selectOrgUnit')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t('fields.noOrgUnit')}</SelectItem>
                        {filteredOrgUnits.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.path_names}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.employeeId')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('fields.employeeIdPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  {tCommon('cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? tCommon('loading') : tCommon('update')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
