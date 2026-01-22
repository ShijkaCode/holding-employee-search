'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Company {
  id: string
  name: string
  industry: string | null
  logo_url: string | null
  created_at: string | null
}

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  industry: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
})

type CompanyFormValues = z.infer<typeof companySchema>

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [saving, setSaving] = useState(false)

  const t = useTranslations('Admin.companies')
  const tCommon = useTranslations('Common')

  const supabase = createClient()

  // Schema definition inside component to access translations could be better, 
  // but for now we'll keep the schema outside and use default error messages or move it inside if we want translated validation errors.
  // Prioritizing UI text first.

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      industry: '',
      logo_url: '',
    },
  })

  const fetchCompanies = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('companies')
      .select('*')
      .order('name')

    setCompanies(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchCompanies()
  }, [])

  const openCreateDialog = () => {
    setEditingCompany(null)
    form.reset({
      name: '',
      industry: '',
      logo_url: '',
    })
    setShowDialog(true)
  }

  const openEditDialog = (company: Company) => {
    setEditingCompany(company)
    form.reset({
      name: company.name,
      industry: company.industry || '',
      logo_url: company.logo_url || '',
    })
    setShowDialog(true)
  }

  const onSubmit = async (data: CompanyFormValues) => {
    setSaving(true)

    try {
      if (editingCompany) {
        const { error } = await supabase
          .from('companies')
          .update({
            name: data.name,
            industry: data.industry || null,
            logo_url: data.logo_url || null,
          })
          .eq('id', editingCompany.id)

        if (error) throw error
        toast.success(t('messages.updated'))
      } else {
        const { error } = await supabase.from('companies').insert({
          name: data.name,
          industry: data.industry || null,
          logo_url: data.logo_url || null,
        })

        if (error) throw error
        toast.success(t('messages.created'))
      }

      setShowDialog(false)
      fetchCompanies()
    } catch (error) {
      console.error('Error saving company:', error)
      toast.error(t('messages.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const deleteCompany = async (id: string) => {
    if (!confirm(t('messages.confirmDelete'))) return

    try {
      const { error } = await supabase.from('companies').delete().eq('id', id)

      if (error) throw error
      toast.success(t('messages.deleted'))
      fetchCompanies()
    } catch (error) {
      console.error('Error deleting company:', error)
      toast.error(t('messages.deleteError'))
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addCompany')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCompany ? t('editCompany') : t('addCompany')}
              </DialogTitle>
              <DialogDescription>
                {editingCompany
                  ? t('editDesc')
                  : t('addDesc')}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('name')} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t('namePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('industry')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('industryPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="logo_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('logoUrl')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('logoPlaceholder')} {...field} />
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
                    {saving ? tCommon('loading') : editingCompany ? tCommon('update') : tCommon('create')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('allCompanies')}</CardTitle>
          <CardDescription>
            {t('registeredCount', { count: companies.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.company')}</TableHead>
                <TableHead>{t('table.industry')}</TableHead>
                <TableHead>{t('table.created')}</TableHead>
                <TableHead className="w-[100px]">{tCommon('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <span className="font-medium">{company.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {company.industry ? (
                      <Badge variant="secondary">{company.industry}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {company.created_at
                      ? new Date(company.created_at).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(company)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteCompany(company.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {companies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    {t('noCompanies')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
