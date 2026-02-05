'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Simplified import flow for the UI
 * Handles both org unit creation and employee creation
 */

export type OrgHierarchyLevel = {
  level: number
  levelType: string
  name: string
  parentId: string | null
}

export type EmployeeToImport = {
  rowNumber: number
  full_name: string
  email: string
  employee_id?: string
  phone_number?: string
  org_hierarchy: OrgHierarchyLevel[]
}

export type ImportEmployeesResult = {
  success: boolean
  orgUnitsCreated: number
  employeesCreated: number
  employeesUpdated: number
  errors: { row: number; message: string }[]
}

/**
 * Import employees with org hierarchy
 * This replaces the complex client-side loop in employee-importer.tsx
 */
export async function importEmployeesWithHierarchy(
  employees: EmployeeToImport[],
  companyId: string,
  createAuthUsers: boolean = true
): Promise<ImportEmployeesResult> {
  const supabase = await createClient()

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, orgUnitsCreated: 0, employeesCreated: 0, employeesUpdated: 0, errors: [{ row: 0, message: 'Unauthorized' }] }
  }

  // Verify role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'hr'].includes(profile.role)) {
    return { success: false, orgUnitsCreated: 0, employeesCreated: 0, employeesUpdated: 0, errors: [{ row: 0, message: 'Forbidden' }] }
  }

  if (profile.role === 'hr' && profile.company_id !== companyId) {
    return { success: false, orgUnitsCreated: 0, employeesCreated: 0, employeesUpdated: 0, errors: [{ row: 0, message: 'Cannot import for other companies' }] }
  }

  const result: ImportEmployeesResult = {
    success: true,
    orgUnitsCreated: 0,
    employeesCreated: 0,
    employeesUpdated: 0,
    errors: [],
  }

  const orgUnitCache = new Map<string, string>()

  for (const emp of employees) {
    try {
      // 1. Create/find org units in hierarchy
      let currentParentId: string | null = null
      let leafUnitId: string | null = null

      for (const level of emp.org_hierarchy) {
        const cacheKey: string = `${companyId}:${currentParentId || 'root'}:${level.name}`

        if (orgUnitCache.has(cacheKey)) {
          currentParentId = orgUnitCache.get(cacheKey)!
          leafUnitId = currentParentId
          continue
        }

        // Find or create org unit
        let existingQuery = supabase
          .from('org_units')
          .select('id')
          .eq('company_id', companyId)
          .eq('name', level.name)

        // Handle null parent_id properly
        if (currentParentId === null) {
          existingQuery = existingQuery.is('parent_id', null)
        } else {
          existingQuery = existingQuery.eq('parent_id', currentParentId)
        }

        const existingRes = await existingQuery.maybeSingle()
        const existing = existingRes.data as { id: string } | null

        if (existing) {
          currentParentId = existing.id
          leafUnitId = existing.id
          orgUnitCache.set(cacheKey, existing.id)
        } else {
          const newUnitRes = await supabase
            .from('org_units')
            .insert({
              company_id: companyId,
              parent_id: currentParentId,
              name: level.name,
              level_type: level.levelType,
              level_depth: level.level - 1,
            })
            .select('id')
            .single()

          const newUnit = newUnitRes.data as { id: string } | null
          const error = newUnitRes.error

          if (error || !newUnit) {
            throw new Error(`Failed to create org unit ${level.name}: ${error?.message}`)
          }

          currentParentId = newUnit.id
          leafUnitId = newUnit.id
          orgUnitCache.set(cacheKey, newUnit.id)
          result.orgUnitsCreated++
        }
      }

      if (!leafUnitId) {
        result.errors.push({ row: emp.rowNumber, message: 'No org unit created' })
        continue
      }

      // 2. Check if employee exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', companyId)
        .or(`email.eq.${emp.email}${emp.employee_id ? `,employee_id.eq.${emp.employee_id}` : ''}`)
        .maybeSingle()

      if (existing) {
        // Update existing employee
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: emp.full_name,
            org_unit_id: leafUnitId,
            employee_id: emp.employee_id || null,
            phone_number: emp.phone_number || null,
          })
          .eq('id', existing.id)

        if (error) {
          result.errors.push({ row: emp.rowNumber, message: `Update failed: ${error.message}` })
        } else {
          result.employeesUpdated++
        }
      } else {
        // Create new employee
        // Generate a UUID for the new employee
        const newEmployeeId = crypto.randomUUID()

        // Create auth user if requested
        if (createAuthUsers) {
          const tempPassword = `${newEmployeeId}-${Date.now()}`
          const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            id: newEmployeeId,
            email: emp.email,
            password: tempPassword,
            email_confirm: true, // No confirmation email
            user_metadata: {
              employee_id: emp.employee_id || null,
              full_name: emp.full_name,
            },
          })

          if (authError) {
            console.error('Auth user creation failed:', authError)
            result.errors.push({ row: emp.rowNumber, message: `Auth user creation failed: ${authError.message}` })
            continue
          }

          // Auth user created successfully, now update the auto-created profile with additional fields
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              company_id: companyId,
              employee_id: emp.employee_id || null,
              phone_number: emp.phone_number || null,
              org_unit_id: leafUnitId,
              role: 'employee',
              invitation_status: 'pending',
              auth_method: emp.phone_number ? 'both' : 'email',
            })
            .eq('id', newEmployeeId)

          if (updateError) {
            result.errors.push({ row: emp.rowNumber, message: `Profile update failed: ${updateError.message}` })
          } else {
            result.employeesCreated++
          }
        } else {
          // No auth user, create profile directly
          const { error } = await supabase
            .from('profiles')
            .insert({
              id: newEmployeeId,
              company_id: companyId,
              full_name: emp.full_name,
              email: emp.email,
              employee_id: emp.employee_id || null,
              phone_number: emp.phone_number || null,
              org_unit_id: leafUnitId,
              role: 'employee',
              invitation_status: 'pending',
              auth_method: emp.phone_number ? 'both' : 'email',
            })

          if (error) {
            result.errors.push({ row: emp.rowNumber, message: `Profile creation failed: ${error.message}` })
          } else {
            result.employeesCreated++
          }
        }
      }
    } catch (error) {
      result.errors.push({
        row: emp.rowNumber,
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  revalidatePath('/employees')
  return result
}
