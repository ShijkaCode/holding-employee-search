'use client'

import { useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronDown,
  ChevronRight,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

import { useHierarchyData } from '../hooks/use-hierarchy-data'
import { useRowSpanning } from '../hooks/use-row-spanning'
import { AnonymityGuard, AnonymityProtected } from './anonymity-guard'
import type {
  EmployeeStatus,
  HierarchyNode,
  ExpandedState,
  FlattenedRow,
} from './types'

interface SurveyStatusTableProps {
  surveyId: string
  companyId: string | null
  anonymityThreshold?: number // Optional: defaults to 5 if not provided
}

export function SurveyStatusTable({ surveyId, companyId, anonymityThreshold }: SurveyStatusTableProps) {
  const t = useTranslations('HierarchyTable')
  const { data, loading, error, refetch } = useHierarchyData(surveyId, companyId, { anonymityThreshold })
  const [expandedState, setExpandedState] = useState<ExpandedState>({})

  // Calculate flattened rows with row spanning
  const flatRows = useRowSpanning({
    tree: data?.tree || [],
    maxLevelDepth: data?.maxLevelDepth || 0,
    expandedState,
    showUnassigned: true,
  })

  // Get unique level types for headers
  const levelHeaders = useMemo(() => {
    if (!data) return []
    const headers: { depth: number; type: string }[] = []

    const collectLevelTypes = (nodes: HierarchyNode[]) => {
      nodes.forEach(node => {
        if (!headers.find(h => h.depth === node.levelDepth)) {
          headers.push({ depth: node.levelDepth, type: node.levelType })
        }
        collectLevelTypes(node.children)
      })
    }

    collectLevelTypes(data.tree)
    return headers.sort((a, b) => a.depth - b.depth)
  }, [data])

  // Toggle expand/collapse for a node
  const toggleExpanded = (nodeId: string) => {
    setExpandedState(prev => ({
      ...prev,
      [nodeId]: prev[nodeId] === false ? true : false,
    }))
  }

  // Expand all nodes
  const expandAll = () => {
    const newState: ExpandedState = {}
    const setAllExpanded = (nodes: HierarchyNode[]) => {
      nodes.forEach(node => {
        newState[node.id] = true
        setAllExpanded(node.children)
      })
    }
    if (data) setAllExpanded(data.tree)
    setExpandedState(newState)
  }

  // Collapse all nodes
  const collapseAll = () => {
    const newState: ExpandedState = {}
    const setAllCollapsed = (nodes: HierarchyNode[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0 || node.employees.length > 0) {
          newState[node.id] = false
        }
        setAllCollapsed(node.children)
      })
    }
    if (data) setAllCollapsed(data.tree)
    setExpandedState(newState)
  }

  if (loading) {
    return <SurveyStatusTableSkeleton />
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <p className="font-medium">{t('errorTitle')}</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={refetch} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || flatRows.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="font-medium">{t('noData')}</p>
              <p className="text-sm text-muted-foreground">{t('noDataDesc')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label={t('totalEmployees')}
          value={data.summary.totalEmployees}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
          label={t('completed')}
          value={data.summary.totalCompleted}
          subValue={`${data.summary.overallCompletionRate}%`}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          label={t('partial')}
          value={data.summary.totalPartial}
        />
        <StatCard
          icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
          label={t('anonymityRiskUnits')}
          value={data.summary.unitsAtAnonymityRisk}
          variant="warning"
        />
      </div>

      {/* Table Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            {t('expandAll')}
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            {t('collapseAll')}
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={refetch}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('refresh')}
        </Button>
      </div>

      {/* Main Table with Virtual Scrolling */}
      <VirtualizedTable
        flatRows={flatRows}
        levelHeaders={levelHeaders}
        data={data}
        expandedState={expandedState}
        toggleExpanded={toggleExpanded}
        t={t}
      />
    </div>
  )
}

// Virtualized table component for performance with large datasets
interface VirtualizedTableProps {
  flatRows: FlattenedRow[]
  levelHeaders: { depth: number; type: string }[]
  data: NonNullable<ReturnType<typeof useHierarchyData>['data']>
  expandedState: ExpandedState
  toggleExpanded: (nodeId: string) => void
  t: ReturnType<typeof useTranslations<'HierarchyTable'>>
}

function VirtualizedTable({
  flatRows,
  levelHeaders,
  data,
  expandedState,
  toggleExpanded,
  t,
}: VirtualizedTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // Estimated row height in pixels
    overscan: 10, // Render 10 extra rows for smooth scrolling
  })

  return (
    <Card>
      <div
        ref={parentRef}
        className="h-[600px] overflow-auto"
        style={{ contain: 'strict' }}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              {levelHeaders.map(header => (
                <TableHead key={header.depth} className="min-w-[150px]">
                  {header.type}
                </TableHead>
              ))}
              <TableHead className="min-w-[200px]">{t('employee')}</TableHead>
              <TableHead className="min-w-[100px]">{t('status')}</TableHead>
              <TableHead className="min-w-[150px]">{t('submittedAt')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <tr>
              <td colSpan={levelHeaders.length + 3} style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = flatRows[virtualRow.index]
                  return (
                    <TableRow
                      key={`${row.employee.id}-${virtualRow.index}`}
                      data-index={virtualRow.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {/* Hierarchy Level Cells */}
                      {row.hierarchyLevels.map((level, levelIndex) => {
                        // Skip cells that are part of a span (rowSpan = 0)
                        if (level.rowSpan === 0) return null

                        const hasChildren = findNodeHasChildren(data.tree, level.id)
                        const isCollapsed = expandedState[level.id] === false

                        return (
                          <TableCell
                            key={`${level.id}-${levelIndex}`}
                            className={cn(
                              'align-top border-r bg-muted/30',
                              level.isAnonymityRisk && 'bg-amber-50'
                            )}
                          >
                            {level.name && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  {hasChildren && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={() => toggleExpanded(level.id)}
                                    >
                                      {isCollapsed ? (
                                        <ChevronRight className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                  <span className="font-medium">{level.name}</span>
                                  {level.isAnonymityRisk && (
                                    <AnonymityGuard
                                      responseCount={level.stats.totalCompleted}
                                      variant="icon"
                                    />
                                  )}
                                </div>
                                <AnonymityProtected
                                  responseCount={level.stats.totalCompleted}
                                  fallback={
                                    <span className="text-xs text-muted-foreground italic">
                                      {t('dataHidden')}
                                    </span>
                                  }
                                >
                                  <div className="text-xs text-muted-foreground">
                                    {level.stats.totalCompleted}/{level.stats.totalAssigned} {t('completedShort')}
                                    <span className="ml-1">({level.stats.completionRate}%)</span>
                                  </div>
                                </AnonymityProtected>
                              </div>
                            )}
                          </TableCell>
                        )
                      })}

                      {/* Employee Info */}
                      <TableCell>
                        <div>
                          <p className="font-medium">{row.employee.fullName}</p>
                          {row.employee.email && (
                            <p className="text-xs text-muted-foreground">{row.employee.email}</p>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <StatusBadge status={row.employee.status} progress={row.employee.progress} />
                      </TableCell>

                      {/* Submitted At */}
                      <TableCell>
                        {row.employee.submittedAt ? (
                          <span className="text-sm">
                            {new Date(row.employee.submittedAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </td>
            </tr>
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}

// Helper to check if a node has children
function findNodeHasChildren(tree: HierarchyNode[], nodeId: string): boolean {
  for (const node of tree) {
    if (node.id === nodeId) {
      return node.children.length > 0
    }
    const found = findNodeHasChildren(node.children, nodeId)
    if (found !== undefined) return found
  }
  return false
}

// Status badge component
function StatusBadge({ status, progress }: { status: EmployeeStatus; progress?: number }) {
  const t = useTranslations('HierarchyTable')

  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          {t('statusCompleted')}
        </Badge>
      )
    case 'partial':
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          <Clock className="mr-1 h-3 w-3" />
          {t('statusPartial')} {progress !== undefined && `(${progress}%)`}
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary">
          {t('statusPending')}
        </Badge>
      )
  }
}

// Stat card component
interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number
  subValue?: string
  variant?: 'default' | 'warning'
}

function StatCard({ icon, label, value, subValue, variant = 'default' }: StatCardProps) {
  return (
    <Card className={cn(variant === 'warning' && value > 0 && 'border-amber-200 bg-amber-50/50')}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {subValue && <span className="text-sm text-muted-foreground">{subValue}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

// Loading skeleton
function SurveyStatusTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
