'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { Plus, Network } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { OrgTreeView, type OrgUnitNode } from '@/components/org-units/org-tree-view'
import { OrgUnitForm, type OrgUnitFormValues } from '@/components/org-units/org-unit-form'

interface FlatOrgUnit {
  id: string
  name: string
  path_names: string
  level_depth: number
}

interface RawOrgUnit {
  id: string
  name: string
  level_type: string
  level_depth: number
  sort_order: number | null
  parent_id: string | null
}

export default function OrgUnitsPage() {
  const [treeData, setTreeData] = useState<OrgUnitNode[]>([])
  const [flatUnits, setFlatUnits] = useState<FlatOrgUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<OrgUnitNode | null>(null)
  const [parentIdForNew, setParentIdForNew] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { profile } = useAuth()
  const t = useTranslations('Admin.orgUnits')
  const tCommon = useTranslations('Common')

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!profile?.company_id) return

    setLoading(true)

    // Fetch all org units
    const { data: unitsData, error: unitsError } = await supabase
      .from('org_units')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('sort_order')
      .order('name')

    if (unitsError) {
      console.error('Error fetching org units:', unitsError)
      toast.error(t('messages.createError'))
      setLoading(false)
      return
    }

    // Fetch hierarchy for flat list (for parent selection)
    const { data: hierarchyData } = await supabase
      .from('org_hierarchy')
      .select('id, name, path_names, level_depth')
      .eq('company_id', profile.company_id)
      .order('path_names')

    // Fetch employee counts per unit
    const { data: employeeCounts } = await supabase
      .from('profiles')
      .select('org_unit_id')
      .eq('company_id', profile.company_id)
      .not('org_unit_id', 'is', null)

    // Build count map
    const countMap = new Map<string, number>()
    employeeCounts?.forEach((p) => {
      if (p.org_unit_id) {
        const current = countMap.get(p.org_unit_id) || 0
        countMap.set(p.org_unit_id, current + 1)
      }
    })

    // Build tree structure
    const buildTree = (parentId: string | null): OrgUnitNode[] => {
      return (unitsData || [])
        .filter((u: RawOrgUnit) => u.parent_id === parentId)
        .map((u: RawOrgUnit) => ({
          id: u.id,
          name: u.name,
          level_type: u.level_type,
          level_depth: u.level_depth,
          sort_order: u.sort_order,
          employee_count: countMap.get(u.id) || 0,
          children: buildTree(u.id),
        }))
    }

    setTreeData(buildTree(null))

    // Set flat units for parent selection
    const validFlatUnits: FlatOrgUnit[] = []
    hierarchyData?.forEach((h) => {
      if (h.id && h.name && h.path_names !== null && h.level_depth !== null) {
        validFlatUnits.push({
          id: h.id,
          name: h.name,
          path_names: h.path_names,
          level_depth: h.level_depth,
        })
      }
    })
    setFlatUnits(validFlatUnits)

    setLoading(false)
  }, [profile?.company_id, supabase, t])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddChild = (parentId: string | null) => {
    setParentIdForNew(parentId)
    setShowAddDialog(true)
  }

  const handleEdit = (unit: OrgUnitNode) => {
    setSelectedUnit(unit)
    setShowEditDialog(true)
  }

  const handleDelete = (unit: OrgUnitNode) => {
    setSelectedUnit(unit)
    setShowDeleteDialog(true)
  }

  const handleCreateSubmit = async (data: OrgUnitFormValues) => {
    if (!profile?.company_id) return

    setIsSubmitting(true)
    try {
      // Calculate level_depth based on parent
      let levelDepth = 0
      if (data.parent_id) {
        const parent = flatUnits.find((u) => u.id === data.parent_id)
        if (parent) {
          levelDepth = parent.level_depth + 1
        }
      }

      const { error } = await supabase.from('org_units').insert({
        company_id: profile.company_id,
        name: data.name,
        level_type: data.level_type,
        parent_id: data.parent_id,
        level_depth: levelDepth,
        sort_order: data.sort_order,
      })

      if (error) throw error

      toast.success(t('messages.created'))
      setShowAddDialog(false)
      setParentIdForNew(null)
      fetchData()
    } catch (error) {
      console.error('Error creating unit:', error)
      toast.error(t('messages.createError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSubmit = async (data: OrgUnitFormValues) => {
    if (!selectedUnit) return

    setIsSubmitting(true)
    try {
      // Calculate level_depth based on parent
      let levelDepth = 0
      if (data.parent_id) {
        const parent = flatUnits.find((u) => u.id === data.parent_id)
        if (parent) {
          levelDepth = parent.level_depth + 1
        }
      }

      const { error } = await supabase
        .from('org_units')
        .update({
          name: data.name,
          level_type: data.level_type,
          parent_id: data.parent_id,
          level_depth: levelDepth,
          sort_order: data.sort_order,
        })
        .eq('id', selectedUnit.id)

      if (error) throw error

      toast.success(t('messages.updated'))
      setShowEditDialog(false)
      setSelectedUnit(null)
      fetchData()
    } catch (error) {
      console.error('Error updating unit:', error)
      toast.error(t('messages.updateError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedUnit) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('org_units')
        .delete()
        .eq('id', selectedUnit.id)

      if (error) throw error

      toast.success(t('messages.deleted'))
      setShowDeleteDialog(false)
      setSelectedUnit(null)
      fetchData()
    } catch (error) {
      console.error('Error deleting unit:', error)
      toast.error(t('messages.deleteError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Find parent_id for selected unit (for edit form)
  const getParentId = (unitId: string): string | null => {
    const findParent = (nodes: OrgUnitNode[], targetId: string, parentId: string | null): string | null => {
      for (const node of nodes) {
        if (node.id === targetId) return parentId
        const found = findParent(node.children, targetId, node.id)
        if (found !== undefined) return found
      }
      return null
    }
    return findParent(treeData, unitId, null)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={() => handleAddChild(null)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addRootUnit')}
        </Button>
      </div>

      {/* Tree View */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>{t('tree')}</CardTitle>
              <CardDescription>{t('treeDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <OrgTreeView
            nodes={treeData}
            onAddChild={handleAddChild}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addUnit')}</DialogTitle>
            <DialogDescription>{t('addDesc')}</DialogDescription>
          </DialogHeader>
          <OrgUnitForm
            defaultValues={{
              parent_id: parentIdForNew,
            }}
            flatUnits={flatUnits}
            onSubmit={handleCreateSubmit}
            onCancel={() => {
              setShowAddDialog(false)
              setParentIdForNew(null)
            }}
            isSubmitting={isSubmitting}
            mode="create"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editUnit')}</DialogTitle>
            <DialogDescription>{t('editDesc')}</DialogDescription>
          </DialogHeader>
          {selectedUnit && (
            <OrgUnitForm
              defaultValues={{
                name: selectedUnit.name,
                level_type: selectedUnit.level_type,
                parent_id: getParentId(selectedUnit.id),
                sort_order: selectedUnit.sort_order || 0,
              }}
              flatUnits={flatUnits}
              excludeId={selectedUnit.id}
              onSubmit={handleEditSubmit}
              onCancel={() => {
                setShowEditDialog(false)
                setSelectedUnit(null)
              }}
              isSubmitting={isSubmitting}
              mode="edit"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('messages.deleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
