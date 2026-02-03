'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  ChevronDown,
  Building2,
  FolderClosed,
  FileText,
  Users,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslations } from 'next-intl'

export interface OrgUnitNode {
  id: string
  name: string
  level_type: string
  level_depth: number
  sort_order: number | null
  employee_count: number
  children: OrgUnitNode[]
}

interface OrgTreeViewProps {
  nodes: OrgUnitNode[]
  onAddChild?: (parentId: string | null) => void
  onEdit?: (unit: OrgUnitNode) => void
  onDelete?: (unit: OrgUnitNode) => void
  selectedId?: string | null
  onSelect?: (unit: OrgUnitNode | null) => void
}

interface TreeNodeProps {
  node: OrgUnitNode
  level: number
  isLast: boolean
  parentLines: boolean[]
  onAddChild?: (parentId: string) => void
  onEdit?: (unit: OrgUnitNode) => void
  onDelete?: (unit: OrgUnitNode) => void
  selectedId?: string | null
  onSelect?: (unit: OrgUnitNode | null) => void
}

const LEVEL_COLORS = [
  'text-blue-600 dark:text-blue-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-amber-600 dark:text-amber-400',
  'text-purple-600 dark:text-purple-400',
  'text-rose-600 dark:text-rose-400',
]

function getNodeIcon(level: number, hasChildren: boolean, isExpanded: boolean) {
  if (level === 0) {
    return <Building2 className="h-4 w-4" />
  }
  if (hasChildren) {
    return <FolderClosed className="h-4 w-4" />
  }
  return <FileText className="h-4 w-4" />
}

function TreeNode({
  node,
  level,
  isLast,
  parentLines,
  onAddChild,
  onEdit,
  onDelete,
  selectedId,
  onSelect,
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2)
  const t = useTranslations('Admin.orgUnits')

  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id
  const colorClass = LEVEL_COLORS[level % LEVEL_COLORS.length]

  const handleToggle = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded)
    }
  }

  const handleSelect = () => {
    onSelect?.(isSelected ? null : node)
  }

  return (
    <div className="select-none">
      <div
        className={cn(
          'group flex items-center py-1.5 rounded-md cursor-pointer transition-colors',
          'hover:bg-accent/50',
          isSelected && 'bg-accent'
        )}
      >
        {/* Tree lines */}
        <div className="flex items-center shrink-0">
          {parentLines.map((showLine, i) => (
            <span
              key={i}
              className="w-6 h-8 flex items-center justify-center"
            >
              {showLine && (
                <span className="w-px h-full bg-border" />
              )}
            </span>
          ))}

          {level > 0 && (
            <span className="w-6 h-8 flex items-center justify-center relative">
              {/* Vertical line */}
              <span
                className={cn(
                  "absolute left-1/2 w-px bg-border",
                  isLast ? "top-0 h-1/2" : "top-0 h-full"
                )}
              />
              {/* Horizontal line */}
              <span className="absolute left-1/2 top-1/2 w-3 h-px bg-border" />
            </span>
          )}
        </div>

        {/* Expand/Collapse */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 shrink-0"
          onClick={handleToggle}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="w-4" />
          )}
        </Button>

        {/* Icon */}
        <span className={cn('shrink-0 mr-2', colorClass)}>
          {getNodeIcon(level, hasChildren, isExpanded)}
        </span>

        {/* Content */}
        <div
          className="flex-1 flex items-center gap-2 min-w-0 pr-2"
          onClick={handleSelect}
        >
          <span className="font-medium truncate">{node.name}</span>
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px] px-1.5 py-0 h-5 shrink-0 font-normal',
              level === 0 && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
              level === 1 && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
              level >= 2 && 'bg-muted'
            )}
          >
            {node.level_type}
          </Badge>
          {node.employee_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Users className="h-3 w-3" />
              {node.employee_count}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAddChild?.(node.id)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('addChildUnit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(node)}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('editUnit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete?.(node)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('deleteUnit')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child, index) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              isLast={index === node.children.length - 1}
              parentLines={[...parentLines, !isLast]}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function OrgTreeView({
  nodes,
  onAddChild,
  onEdit,
  onDelete,
  selectedId,
  onSelect,
}: OrgTreeViewProps) {
  const t = useTranslations('Admin.orgUnits')

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
        <Building2 className="h-12 w-12 mb-4 opacity-40" />
        <p className="font-medium text-foreground">{t('noUnits')}</p>
        <p className="text-sm mt-1">{t('noUnitsDesc')}</p>
        {onAddChild && (
          <Button className="mt-6" onClick={() => onAddChild(null)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addRootUnit')}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-3 bg-card">
      {nodes.map((node, index) => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
          isLast={index === nodes.length - 1}
          parentLines={[]}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
