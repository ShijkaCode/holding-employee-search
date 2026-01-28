'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslations } from 'next-intl'
import type { OrgUnitNode } from './org-tree-view'

const orgUnitSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  level_type: z.string().min(1, 'Level type is required'),
  parent_id: z.string().nullable(),
  sort_order: z.number().int().min(0),
})

export type OrgUnitFormValues = z.infer<typeof orgUnitSchema>

interface FlatOrgUnit {
  id: string
  name: string
  path_names: string
  level_depth: number
}

interface OrgUnitFormProps {
  defaultValues?: Partial<OrgUnitFormValues>
  flatUnits: FlatOrgUnit[] // For parent selection
  excludeId?: string // Exclude current unit and its descendants from parent options
  onSubmit: (data: OrgUnitFormValues) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
  mode: 'create' | 'edit'
}

const LEVEL_TYPE_PRESETS = [
  'Division',
  'Department',
  'Team',
  'Group',
  'Unit',
  'Газар',
  'Алба',
  'Хэлтэс',
  'Баг',
  'Тасаг',
]

export function OrgUnitForm({
  defaultValues,
  flatUnits,
  excludeId,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode,
}: OrgUnitFormProps) {
  const t = useTranslations('Admin.orgUnits')
  const tCommon = useTranslations('Common')

  const form = useForm<OrgUnitFormValues>({
    resolver: zodResolver(orgUnitSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      level_type: defaultValues?.level_type || '',
      parent_id: defaultValues?.parent_id || null,
      sort_order: defaultValues?.sort_order || 0,
    },
  })

  // Filter out the current unit and its descendants from parent options
  const availableParents = flatUnits.filter((unit) => {
    if (!excludeId) return true
    // Exclude the unit itself and any unit whose path contains the excluded id
    return unit.id !== excludeId
  })

  const handleSubmit = async (data: OrgUnitFormValues) => {
    await onSubmit(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
          name="level_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('levelType')} *</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <Input
                    placeholder={t('levelTypePlaceholder')}
                    {...field}
                  />
                  <div className="flex flex-wrap gap-1">
                    {LEVEL_TYPE_PRESETS.map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => form.setValue('level_type', preset)}
                      >
                        {preset}
                      </Button>
                    ))}
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="parent_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('parentUnit')}</FormLabel>
              <Select
                onValueChange={(value) =>
                  field.onChange(value === 'none' ? null : value)
                }
                value={field.value || 'none'}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('parentPlaceholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">{t('noParent')}</SelectItem>
                  {availableParents.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      <span
                        style={{ paddingLeft: `${unit.level_depth * 12}px` }}
                      >
                        {unit.path_names}
                      </span>
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
          name="sort_order"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('sortOrder')}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  placeholder={t('sortOrderPlaceholder')}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? tCommon('loading')
              : mode === 'create'
              ? tCommon('create')
              : tCommon('update')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
