'use client'

import { useMemo } from 'react'
import type {
  HierarchyNode,
  FlattenedRow,
  HierarchyLevelCell,
  ExpandedState,
} from '../hierarchy-table/types'

interface UseRowSpanningOptions {
  tree: HierarchyNode[]
  maxLevelDepth: number
  expandedState?: ExpandedState
  showUnassigned?: boolean
}

// Count all employees under a node (including descendants)
function countAllEmployees(node: HierarchyNode): number {
  const directCount = node.employees.length
  const childrenCount = node.children.reduce(
    (sum, child) => sum + countAllEmployees(child),
    0
  )
  return directCount + childrenCount
}

// Collect all employees under a node in order
function collectAllEmployees(node: HierarchyNode): { employee: FlattenedRow['employee']; leafNode: HierarchyNode }[] {
  const result: { employee: FlattenedRow['employee']; leafNode: HierarchyNode }[] = []

  // First add direct employees
  node.employees.forEach(emp => {
    result.push({ employee: emp, leafNode: node })
  })

  // Then add from children (in order)
  node.children.forEach(child => {
    result.push(...collectAllEmployees(child))
  })

  return result
}

export function useRowSpanning({
  tree,
  maxLevelDepth,
  expandedState = {},
  showUnassigned = true,
}: UseRowSpanningOptions): FlattenedRow[] {
  return useMemo(() => {
    const rows: FlattenedRow[] = []

    // Track which cells should span rows
    interface SpanTracker {
      nodeId: string
      name: string
      levelType: string
      levelDepth: number
      stats: HierarchyNode['stats']
      isAnonymityRisk: boolean
      startRow: number
      rowCount: number
    }

    const activeSpans: Map<number, SpanTracker> = new Map()

    function processNode(node: HierarchyNode, ancestors: HierarchyNode[] = []) {
      const allEmployeesUnderNode = collectAllEmployees(node)
      const totalRowsForNode = allEmployeesUnderNode.length

      if (totalRowsForNode === 0) {
        // No employees - skip this node but process children
        node.children.forEach(child => processNode(child, [...ancestors, node]))
        return
      }

      // Check if this node is collapsed
      const isCollapsed = expandedState[node.id] === false

      if (isCollapsed) {
        // Show a single summary row for collapsed node
        const summaryRow: FlattenedRow = {
          rowIndex: rows.length,
          employee: {
            id: `summary-${node.id}`,
            fullName: `${totalRowsForNode} employees`,
            email: null,
            employeeId: null,
            status: 'pending',
            submittedAt: null,
          },
          hierarchyLevels: [],
          leafNodeId: node.id,
          leafNodeName: node.name,
        }

        // Build hierarchy levels for summary row
        const allAncestors = [...ancestors, node]
        for (let level = 0; level <= maxLevelDepth; level++) {
          const ancestorAtLevel = allAncestors.find(a => a.levelDepth === level)
          if (ancestorAtLevel) {
            summaryRow.hierarchyLevels.push({
              id: ancestorAtLevel.id,
              name: ancestorAtLevel.name,
              levelType: ancestorAtLevel.levelType,
              levelDepth: ancestorAtLevel.levelDepth,
              rowSpan: 1,
              isFirstInSpan: true,
              stats: ancestorAtLevel.stats,
              isAnonymityRisk: ancestorAtLevel.isAnonymityRisk,
            })
          } else {
            // Fill empty level
            summaryRow.hierarchyLevels.push({
              id: '',
              name: '',
              levelType: '',
              levelDepth: level,
              rowSpan: 0,
              isFirstInSpan: false,
              stats: { totalAssigned: 0, totalCompleted: 0, totalPartial: 0, completionRate: 0 },
              isAnonymityRisk: false,
            })
          }
        }

        rows.push(summaryRow)
        return
      }

      // Process employees under this node
      const startRowIndex = rows.length

      allEmployeesUnderNode.forEach((item, index) => {
        const row: FlattenedRow = {
          rowIndex: rows.length,
          employee: item.employee,
          hierarchyLevels: [],
          leafNodeId: item.leafNode.id,
          leafNodeName: item.leafNode.name,
        }

        // Build the hierarchy path to this employee
        const pathToEmployee: HierarchyNode[] = []

        // Find the path from root to leaf node
        function findPath(nodes: HierarchyNode[], target: string, path: HierarchyNode[]): boolean {
          for (const n of nodes) {
            const newPath = [...path, n]
            if (n.id === target) {
              pathToEmployee.push(...newPath)
              return true
            }
            if (findPath(n.children, target, newPath)) {
              return true
            }
          }
          return false
        }

        findPath(tree, item.leafNode.id, [])

        // For each level, determine if we need a new span or continue existing
        for (let level = 0; level <= maxLevelDepth; level++) {
          const nodeAtLevel = pathToEmployee.find(n => n.levelDepth === level)
          const existingSpan = activeSpans.get(level)

          if (nodeAtLevel) {
            if (existingSpan && existingSpan.nodeId === nodeAtLevel.id) {
              // Continue existing span
              existingSpan.rowCount++
              row.hierarchyLevels.push({
                id: nodeAtLevel.id,
                name: '', // Empty for continuation
                levelType: '',
                levelDepth: level,
                rowSpan: 0, // Will be skipped in rendering
                isFirstInSpan: false,
                stats: nodeAtLevel.stats,
                isAnonymityRisk: nodeAtLevel.isAnonymityRisk,
              })
            } else {
              // Start new span
              // Update previous span's rowCount
              if (existingSpan) {
                const firstRowOfPrevSpan = rows[existingSpan.startRow]
                if (firstRowOfPrevSpan) {
                  const levelCell = firstRowOfPrevSpan.hierarchyLevels[level]
                  if (levelCell) {
                    levelCell.rowSpan = existingSpan.rowCount
                  }
                }
              }

              // Start tracking new span
              activeSpans.set(level, {
                nodeId: nodeAtLevel.id,
                name: nodeAtLevel.name,
                levelType: nodeAtLevel.levelType,
                levelDepth: level,
                stats: nodeAtLevel.stats,
                isAnonymityRisk: nodeAtLevel.isAnonymityRisk,
                startRow: rows.length,
                rowCount: 1,
              })

              row.hierarchyLevels.push({
                id: nodeAtLevel.id,
                name: nodeAtLevel.name,
                levelType: nodeAtLevel.levelType,
                levelDepth: level,
                rowSpan: 1, // Will be updated when span ends
                isFirstInSpan: true,
                stats: nodeAtLevel.stats,
                isAnonymityRisk: nodeAtLevel.isAnonymityRisk,
              })
            }
          } else {
            // No node at this level - empty cell
            row.hierarchyLevels.push({
              id: '',
              name: '',
              levelType: '',
              levelDepth: level,
              rowSpan: 0,
              isFirstInSpan: false,
              stats: { totalAssigned: 0, totalCompleted: 0, totalPartial: 0, completionRate: 0 },
              isAnonymityRisk: false,
            })
          }
        }

        rows.push(row)
      })

      // Finalize any remaining spans for this node's subtree
      // (Spans that started in this subtree should end here)
    }

    // Process all root nodes
    tree.forEach(rootNode => processNode(rootNode, []))

    // Finalize all remaining spans
    activeSpans.forEach((span, level) => {
      const firstRow = rows[span.startRow]
      if (firstRow) {
        const levelCell = firstRow.hierarchyLevels[level]
        if (levelCell) {
          levelCell.rowSpan = span.rowCount
        }
      }
    })

    return rows
  }, [tree, maxLevelDepth, expandedState, showUnassigned])
}
