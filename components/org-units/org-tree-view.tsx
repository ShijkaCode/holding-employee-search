'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
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
  onAddChild?: (parentId: string) => void
  onEdit?: (unit: OrgUnitNode) => void
  onDelete?: (unit: OrgUnitNode) => void
  selectedId?: string | null
  onSelect?: (unit: OrgUnitNode | null) => void
}

function TreeNode({
  node,
  level,
  onAddChild,
  onEdit,
  onDelete,
  selectedId,
  onSelect,
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2) // Auto-expand first 2 levels
  const t = useTranslations('Admin.orgUnits')

  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id

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
          'group flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer hover:bg-accent',
          isSelected && 'bg-accent'
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {/* Expand/Collapse Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0"
          onClick={handleToggle}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="w-4" />
          )}
        </Button>

        {/* Folder Icon */}
        {hasChildren && isExpanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500 shrink-0" />
        )}

        {/* Name and Info */}
        <div
          className="flex-1 flex items-center gap-2 min-w-0"
          onClick={handleSelect}
        >
          <span className="font-medium truncate">{node.name}</span>
          <Badge variant="outline" className="text-xs shrink-0">
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
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
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
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
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
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Folder className="h-12 w-12 mb-4 opacity-50" />
        <p className="font-medium">{t('noUnits')}</p>
        <p className="text-sm">{t('noUnitsDesc')}</p>
        {onAddChild && (
          <Button className="mt-4" onClick={() => onAddChild(null)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addRootUnit')}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
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
