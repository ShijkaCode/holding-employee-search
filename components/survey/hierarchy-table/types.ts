// Types for hierarchical survey status table

export type EmployeeStatus = 'pending' | 'partial' | 'completed'

export interface EmployeeRow {
  id: string
  fullName: string
  email: string | null
  employeeId: string | null
  status: EmployeeStatus
  submittedAt: string | null
  progress?: number // 0-100 for partial responses
}

export interface OrgUnitStats {
  totalAssigned: number
  totalCompleted: number
  totalPartial: number
  completionRate: number
}

export interface HierarchyNode {
  id: string
  name: string
  levelType: string
  levelDepth: number
  pathNames: string
  sortOrder: number
  children: HierarchyNode[]
  employees: EmployeeRow[]
  stats: OrgUnitStats
  isAnonymityRisk: boolean // < 5 responses
}

export interface HierarchyLevelCell {
  id: string
  name: string
  levelType: string
  levelDepth: number
  rowSpan: number // How many rows this cell spans
  isFirstInSpan: boolean
  stats: OrgUnitStats
  isAnonymityRisk: boolean
}

export interface FlattenedRow {
  rowIndex: number
  employee: EmployeeRow
  hierarchyLevels: HierarchyLevelCell[]
  // Parent node info for grouping
  leafNodeId: string
  leafNodeName: string
}

export interface SurveyHierarchyStats {
  tree: HierarchyNode[]
  flatRows: FlattenedRow[]
  maxLevelDepth: number
  levelTypes: string[] // Ordered list of level type names
  summary: {
    totalUnits: number
    totalEmployees: number
    totalCompleted: number
    totalPartial: number
    overallCompletionRate: number
    unitsAtAnonymityRisk: number
  }
  anonymityThreshold: number
}

// Default anonymity threshold (can be overridden per survey/company)
export const DEFAULT_ANONYMITY_THRESHOLD = 5
export const ANONYMITY_THRESHOLD = DEFAULT_ANONYMITY_THRESHOLD

// Helper type for expand/collapse state
export type ExpandedState = Record<string, boolean>
