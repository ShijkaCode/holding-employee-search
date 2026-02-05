'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Folder, FolderOpen, User, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ParsedExcelData } from './upload-step'
import type { ImportConfig, ColumnMapping } from './mapping-step'

interface PreviewNode {
  name: string
  levelType: string
  level: number
  children: Map<string, PreviewNode>
  employees: { name: string; email?: string; employeeId?: string }[]
}

interface PreviewStepProps {
  excelData: ParsedExcelData
  config: ImportConfig
}

export function PreviewStep({ excelData, config }: PreviewStepProps) {
  const t = useTranslations('Import')

  // Build preview tree from data
  const { tree, stats, errors } = useMemo(() => {
    const root: PreviewNode = {
      name: 'Root',
      levelType: '',
      level: 0,
      children: new Map(),
      employees: [],
    }

    const errors: { row: number; message: string }[] = []
    let totalEmployees = 0
    let employeesWithOrg = 0
    const orgUnitsSet = new Set<string>()

    // Get mapping helpers
    const getMapping = (target: string): string | undefined => {
      const mapping = config.mappings.find(m => m.targetField === target)
      return mapping?.sourceColumn
    }

    const getHierarchyMappings = (): ColumnMapping[] => {
      return config.mappings
        .filter(m => m.targetField.startsWith('hierarchy_'))
        .sort((a, b) => {
          const aLevel = parseInt(a.targetField.split('_')[1])
          const bLevel = parseInt(b.targetField.split('_')[1])
          return aLevel - bLevel
        })
    }

    const nameColumn = getMapping('name')
    const emailColumn = getMapping('email')
    const employeeIdColumn = getMapping('employee_id')
    const hierarchyMappings = getHierarchyMappings()

    excelData.rows.forEach((row, rowIndex) => {
      const employeeName = nameColumn ? row.data[nameColumn] : null
      const email = emailColumn ? row.data[emailColumn] : undefined
      const employeeId = employeeIdColumn ? row.data[employeeIdColumn] : undefined

      if (!employeeName) {
        errors.push({ row: rowIndex + 2, message: t('errors.missingName') })
        return
      }

      totalEmployees++

      // Build hierarchy path
      const hierarchyPath: { name: string; levelType: string }[] = []

      for (const mapping of hierarchyMappings) {
        const value = row.data[mapping.sourceColumn]
        if (value) {
          const levelNum = parseInt(mapping.targetField.split('_')[1])
          const levelConfig = config.hierarchyLevels.find(l => l.level === levelNum)
          hierarchyPath.push({
            name: value,
            levelType: levelConfig?.levelType || `Level ${levelNum}`,
          })
        }
      }

      if (hierarchyPath.length > 0) {
        employeesWithOrg++
      }

      // Navigate/create tree nodes
      let currentNode = root

      for (let i = 0; i < hierarchyPath.length; i++) {
        const pathItem = hierarchyPath[i]
        const pathKey = hierarchyPath.slice(0, i + 1).map(p => p.name).join('/')
        orgUnitsSet.add(pathKey)

        if (!currentNode.children.has(pathItem.name)) {
          currentNode.children.set(pathItem.name, {
            name: pathItem.name,
            levelType: pathItem.levelType,
            level: i + 1,
            children: new Map(),
            employees: [],
          })
        }

        currentNode = currentNode.children.get(pathItem.name)!
      }

      // Add employee to the leaf node
      currentNode.employees.push({
        name: employeeName,
        email,
        employeeId,
      })
    })

    return {
      tree: root,
      stats: {
        totalEmployees,
        employeesWithOrg,
        employeesWithoutOrg: totalEmployees - employeesWithOrg,
        totalOrgUnits: orgUnitsSet.size,
      },
      errors,
    }
  }, [excelData.rows, config, t])

  // Render tree node recursively
  const renderNode = (node: PreviewNode, depth: number = 0, isRoot: boolean = false): React.ReactNode => {
    if (isRoot) {
      // Render children of root
      return Array.from(node.children.values()).map((child, i) =>
        renderNode(child, 0, false)
      )
    }

    const hasChildren = node.children.size > 0
    const hasEmployees = node.employees.length > 0

    return (
      <div key={node.name} className="select-none">
        <div
          className="flex items-center gap-2 py-1.5 px-2 hover:bg-accent rounded-md"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {hasChildren ? (
            <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-amber-500 shrink-0" />
          )}
          <span className="font-medium">{node.name}</span>
          <Badge variant="outline" className="text-xs">
            {node.levelType}
          </Badge>
          {hasEmployees && (
            <span className="text-xs text-muted-foreground ml-auto">
              {node.employees.length} {t('employees')}
            </span>
          )}
        </div>

        {/* Render employees at this level */}
        {hasEmployees && (
          <div className="ml-6 border-l-2 border-muted">
            {node.employees.slice(0, 5).map((emp, i) => (
              <div
                key={i}
                className="flex items-center gap-2 py-1 px-2 text-sm"
                style={{ paddingLeft: `${(depth + 1) * 20 + 8}px` }}
              >
                <User className="h-3 w-3 text-muted-foreground" />
                <span>{emp.name}</span>
                {emp.email && (
                  <span className="text-muted-foreground text-xs">{emp.email}</span>
                )}
              </div>
            ))}
            {node.employees.length > 5 && (
              <div
                className="py-1 px-2 text-sm text-muted-foreground"
                style={{ paddingLeft: `${(depth + 1) * 20 + 8}px` }}
              >
                +{node.employees.length - 5} {t('more')}
              </div>
            )}
          </div>
        )}

        {/* Render child nodes */}
        {hasChildren && (
          <div>
            {Array.from(node.children.values()).map(child =>
              renderNode(child, depth + 1, false)
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
            <p className="text-sm text-muted-foreground">{t('stats.totalEmployees')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.totalOrgUnits}</div>
            <p className="text-sm text-muted-foreground">{t('stats.orgUnits')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.employeesWithOrg}</div>
            <p className="text-sm text-muted-foreground">{t('stats.withOrg')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">{stats.employeesWithoutOrg}</div>
            <p className="text-sm text-muted-foreground">{t('stats.withoutOrg')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {t('errors.title', { count: errors.length })}
            </CardTitle>
            <CardDescription>{t('errors.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <div className="space-y-1">
                {errors.slice(0, 10).map((err, i) => (
                  <div key={i} className="text-sm flex items-center gap-2">
                    <Badge variant="outline" className="shrink-0">
                      {t('row', { n: err.row })}
                    </Badge>
                    <span className="text-muted-foreground">{err.message}</span>
                  </div>
                ))}
                {errors.length > 10 && (
                  <p className="text-sm text-muted-foreground">
                    +{errors.length - 10} {t('moreErrors')}
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Tree Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            {t('preview.title')}
          </CardTitle>
          <CardDescription>{t('preview.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] border rounded-lg p-4">
            {renderNode(tree, 0, true)}
            {tree.children.size === 0 && tree.employees.length === 0 && (
              <p className="text-muted-foreground text-center py-8">
                {t('preview.noData')}
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
