'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// ===== SCHEMAS =====

const EmployeeSchema = z.object({
  employee_id: z.string().min(1),
  full_name: z.string().min(1),
  email: z.string().email(),
  org_unit_id: z.string().uuid(),
  phone_number: z.string().optional(),
})

const BulkImportSchema = z.object({
  employees: z.array(EmployeeSchema).min(1).max(10000),
  onDuplicate: z.enum(['skip', 'update']),
  createAuthUsers: z.boolean().default(false),
})

// ===== TYPES =====

export type BulkImportInput = z.infer<typeof BulkImportSchema>

export type BulkImportResult = {
  success: boolean
  results?: {
    created: number
    updated: number
    skipped: number
    failed: number
    errors: { employee_id: string; email: string; error: string }[]
  }
  error?: string
}

// ===== ACTIONS =====

/**
 * Bulk import employees - Server Action following Next.js 16 patterns
 * This replaces the Route Handler in /api/employees/bulk-import
 */
export async function bulkImportEmployees(
  input: BulkImportInput
): Promise<BulkImportResult> {
  const supabase = await createClient()

  // 1. Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  // 2. Verify role (admin or hr)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'hr'].includes(profile.role)) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  if (!profile.company_id) {
    return { success: false, error: 'User has no company assigned' }
  }

  const companyId = profile.company_id

  // 3. Validate input with Zod
  const validated = BulkImportSchema.safeParse(input)
  if (!validated.success) {
    return {
      success: false,
      error: `Validation failed: ${validated.error.issues.map(e => e.message).join(', ')}`
    }
  }

  const { employees, onDuplicate, createAuthUsers } = validated.data

  try {
    // 4. Bulk insert/update using upsert (one query instead of loop!)
    const employeesToInsert = employees.map(emp => ({
      id: crypto.randomUUID(),
      company_id: companyId,
      employee_id: emp.employee_id,
      full_name: emp.full_name,
      email: emp.email,
      phone_number: emp.phone_number || null,
      org_unit_id: emp.org_unit_id,
      role: 'employee' as const,
      invitation_status: 'pending' as const,
      auth_method: emp.phone_number ? 'both' as const : 'email' as const,
    }))

    if (onDuplicate === 'update') {
      // Use upsert for update mode
      const { data, error } = await supabase
        .from('profiles')
        .upsert(employeesToInsert, {
          onConflict: 'company_id,employee_id',
          ignoreDuplicates: false,
        })
        .select('id, email, employee_id')

      if (error) {
        throw new Error(`Bulk upsert failed: ${error.message}`)
      }

      // Create auth users if requested
      if (createAuthUsers && data) {
        const validEmployees = data.filter(
          (d): d is { id: string; email: string; employee_id: string } =>
            d.email !== null && d.employee_id !== null
        )
        await createAuthUsersForEmployees(validEmployees)
      }

      return {
        success: true,
        results: {
          created: 0, // Upsert doesn't distinguish
          updated: data?.length || 0,
          skipped: 0,
          failed: 0,
          errors: [],
        },
      }
    } else {
      // Skip mode: filter out existing employees first
      const employeeIds = employees.map(e => e.employee_id)
      const { data: existing } = await supabase
        .from('profiles')
        .select('employee_id')
        .eq('company_id', companyId)
        .in('employee_id', employeeIds)

      const existingIds = new Set(existing?.map(e => e.employee_id) || [])
      const newEmployees = employeesToInsert.filter(
        e => !existingIds.has(e.employee_id)
      )

      if (newEmployees.length === 0) {
        return {
          success: true,
          results: {
            created: 0,
            updated: 0,
            skipped: employeesToInsert.length,
            failed: 0,
            errors: [],
          },
        }
      }

      // Insert only new employees
      const { data, error } = await supabase
        .from('profiles')
        .insert(newEmployees)
        .select('id, email, employee_id')

      if (error) {
        throw new Error(`Bulk insert failed: ${error.message}`)
      }

      // Create auth users if requested
      if (createAuthUsers && data) {
        const validEmployees = data.filter(
          (d): d is { id: string; email: string; employee_id: string } =>
            d.email !== null && d.employee_id !== null
        )
        await createAuthUsersForEmployees(validEmployees)
      }

      return {
        success: true,
        results: {
          created: data?.length || 0,
          updated: 0,
          skipped: employeesToInsert.length - (data?.length || 0),
          failed: 0,
          errors: [],
        },
      }
    }
  } catch (error) {
    console.error('Bulk import error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import employees',
    }
  } finally {
    // Revalidate to update any cached employee lists
    revalidatePath('/employees', 'page')
  }
}

/**
 * Create Supabase Auth users for employees
 * Uses admin API to create users without sending emails immediately
 */
async function createAuthUsersForEmployees(
  employees: { id: string; email: string; employee_id: string }[]
): Promise<void> {
  for (const emp of employees) {
    try {
      // Check if auth user already exists
      const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(emp.id)

      if (existingUser) {
        // User already exists, skip
        continue
      }

      // Create auth user with a random password
      // The user will use magic links to sign in, so password doesn't matter
      const tempPassword = `${emp.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`

      await supabaseAdmin.auth.admin.createUser({
        id: emp.id, // Use same ID as profile
        email: emp.email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          employee_id: emp.employee_id,
        },
      })
    } catch (error) {
      console.error(`Failed to create auth user for ${emp.email}:`, error)
      // Continue with other employees even if one fails
    }
  }
}
