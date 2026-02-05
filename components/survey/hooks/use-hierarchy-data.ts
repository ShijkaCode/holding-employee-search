'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  HierarchyNode,
  EmployeeRow,
  EmployeeStatus,
  OrgUnitStats,
  SurveyHierarchyStats,
} from '../hierarchy-table/types'
import { DEFAULT_ANONYMITY_THRESHOLD } from '../hierarchy-table/types'

interface RawOrgUnit {
  id: string
  name: string
  level_type: string
  level_depth: number
  sort_order: number | null
  parent_id: string | null
}

interface RawAssignment {
  employee_id: string
  profile: {
    id: string
    full_name: string
    email: string | null
    employee_id: string | null
    org_unit_id: string | null
  } | null
}

interface RawResponse {
  employee_id: string
  status: string
  submitted_at: string | null
  progress?: number
}

interface UseHierarchyDataOptions {
  anonymityThreshold?: number
}

export function useHierarchyData(
  surveyId: string,
  companyId: string | null,
  options: UseHierarchyDataOptions = {}
) {
  const { anonymityThreshold = DEFAULT_ANONYMITY_THRESHOLD } = options
  const [data, setData] = useState<SurveyHierarchyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch all data in parallel
      const [orgUnitsRes, assignmentsRes, responsesRes] = await Promise.all([
        // Get all org units for the company
        supabase
          .from('org_units')
          .select('id, name, level_type, level_depth, sort_order, parent_id')
          .eq('company_id', companyId)
          .order('sort_order')
          .order('name'),

        // Get assignments with profiles (hint the foreign key relationship)
        (supabase as any)
          .from('survey_assignments')
          .select(`
            employee_id,
            profile:profiles!survey_assignments_employee_id_fkey(id, full_name, email, employee_id, org_unit_id)
          `)
          .eq('survey_id', surveyId),

        // Get responses
        supabase
          .from('survey_responses')
          .select('employee_id, status, submitted_at')
          .eq('survey_id', surveyId),
      ])

      if (orgUnitsRes.error) throw orgUnitsRes.error
      if (assignmentsRes.error) throw assignmentsRes.error
      if (responsesRes.error) throw responsesRes.error

      const orgUnits = orgUnitsRes.data as RawOrgUnit[]
      const assignments = assignmentsRes.data as RawAssignment[]
      const responses = responsesRes.data as RawResponse[]

      // Build response map
      const responseMap = new Map<string, RawResponse>()
      responses.forEach(r => {
        responseMap.set(r.employee_id, r)
      })

      // Build employee list per org unit
      const employeesByUnit = new Map<string, EmployeeRow[]>()
      const unassignedEmployees: EmployeeRow[] = []

      assignments.forEach(assignment => {
        const profile = Array.isArray(assignment.profile)
          ? assignment.profile[0]
          : assignment.profile

        if (!profile) return

        const response = responseMap.get(profile.id)
        const status: EmployeeStatus = response?.status === 'completed'
          ? 'completed'
          : response?.status === 'partial'
          ? 'partial'
          : 'pending'

        const employee: EmployeeRow = {
          id: profile.id,
          fullName: profile.full_name,
          email: profile.email,
          employeeId: profile.employee_id,
          status,
          submittedAt: response?.submitted_at || null,
          progress: response?.progress,
        }

        const unitId = profile.org_unit_id
        if (unitId) {
          const existing = employeesByUnit.get(unitId) || []
          existing.push(employee)
          employeesByUnit.set(unitId, existing)
        } else {
          unassignedEmployees.push(employee)
        }
      })

      // Calculate stats for a list of employees
      const calculateStats = (employees: EmployeeRow[]): OrgUnitStats => {
        const totalAssigned = employees.length
        const totalCompleted = employees.filter(e => e.status === 'completed').length
        const totalPartial = employees.filter(e => e.status === 'partial').length
        const completionRate = totalAssigned > 0
          ? Math.round((totalCompleted / totalAssigned) * 100)
          : 0

        return { totalAssigned, totalCompleted, totalPartial, completionRate }
      }

      // Build hierarchy tree
      const buildTree = (parentId: string | null): HierarchyNode[] => {
        return orgUnits
          .filter(u => u.parent_id === parentId)
          .map(unit => {
            const children = buildTree(unit.id)
            const directEmployees = employeesByUnit.get(unit.id) || []

            // Collect all descendant employees
            const getAllEmployees = (nodes: HierarchyNode[]): EmployeeRow[] => {
              return nodes.flatMap(n => [...n.employees, ...getAllEmployees(n.children)])
            }
            const descendantEmployees = getAllEmployees(children)
            const allEmployees = [...directEmployees, ...descendantEmployees]

            const stats = calculateStats(allEmployees)

            return {
              id: unit.id,
              name: unit.name,
              levelType: unit.level_type,
              levelDepth: unit.level_depth,
              pathNames: unit.name, // Will be updated later
              sortOrder: unit.sort_order || 0,
              children,
              employees: directEmployees,
              stats,
              isAnonymityRisk: stats.totalCompleted < anonymityThreshold,
            }
          })
      }

      const tree = buildTree(null)

      // Calculate max depth and level types
      let maxLevelDepth = 0
      const levelTypesSet = new Set<string>()

      const traverseForMeta = (nodes: HierarchyNode[], parentPath: string = '') => {
        nodes.forEach(node => {
          node.pathNames = parentPath ? `${parentPath} > ${node.name}` : node.name
          maxLevelDepth = Math.max(maxLevelDepth, node.levelDepth)
          levelTypesSet.add(node.levelType)
          traverseForMeta(node.children, node.pathNames)
        })
      }
      traverseForMeta(tree)

      // Calculate summary
      const allEmployeesFlat = assignments.map(a => {
        const profile = Array.isArray(a.profile) ? a.profile[0] : a.profile
        return profile?.id
      }).filter(Boolean)

      const summary = {
        totalUnits: orgUnits.length,
        totalEmployees: allEmployeesFlat.length,
        totalCompleted: responses.filter(r => r.status === 'completed').length,
        totalPartial: responses.filter(r => r.status === 'partial').length,
        overallCompletionRate: allEmployeesFlat.length > 0
          ? Math.round((responses.filter(r => r.status === 'completed').length / allEmployeesFlat.length) * 100)
          : 0,
        unitsAtAnonymityRisk: 0, // Will be calculated
      }

      // Count units at anonymity risk
      const countAnonymityRisk = (nodes: HierarchyNode[]): number => {
        return nodes.reduce((count, node) => {
          const riskCount = node.isAnonymityRisk ? 1 : 0
          return count + riskCount + countAnonymityRisk(node.children)
        }, 0)
      }
      summary.unitsAtAnonymityRisk = countAnonymityRisk(tree)

      // For now, flatRows will be calculated by useRowSpanning hook
      setData({
        tree,
        flatRows: [], // Will be populated by useRowSpanning
        maxLevelDepth,
        levelTypes: Array.from(levelTypesSet),
        summary,
        anonymityThreshold,
      })

    } catch (err) {
      console.error('Error fetching hierarchy data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [surveyId, companyId, anonymityThreshold, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
