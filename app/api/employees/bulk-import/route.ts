import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300 // 5 minutes for large imports

interface EmployeeData {
  employee_id: string
  full_name: string
  email: string
  org_unit_id: string
  phone_number?: string
}

interface ImportOptions {
  onDuplicate: 'skip' | 'update'
  createAuthUsers: boolean
}

interface ImportRequest {
  employees: EmployeeData[]
  options: ImportOptions
}

interface ImportResult {
  success: boolean
  results?: {
    created: number
    updated: number
    skipped: number
    failed: number
    errors: {
      employee_id: string
      email: string
      error: string
    }[]
  }
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<ImportResult>> {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile and verify role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'hr'].includes(profile.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions' }, { status: 403 })
    }

    if (!profile.company_id) {
      return NextResponse.json({ success: false, error: 'User has no company assigned' }, { status: 403 })
    }

    const companyId = profile.company_id

    // Parse request body
    const body: ImportRequest = await request.json()
    const { employees, options } = body

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json({ success: false, error: 'No employees provided' }, { status: 400 })
    }

    // Validate limit
    if (employees.length > 10000) {
      return NextResponse.json({ success: false, error: 'Maximum 10,000 employees per import' }, { status: 400 })
    }

    // Initialize result counters
    let created = 0
    let updated = 0
    let skipped = 0
    let failed = 0
    const errors: { employee_id: string; email: string; error: string }[] = []

    // Process employees in batches of 100 for better performance
    const BATCH_SIZE = 100
    for (let i = 0; i < employees.length; i += BATCH_SIZE) {
      const batch = employees.slice(i, i + BATCH_SIZE)

      for (const employee of batch) {
        try {
          const { employee_id, full_name, email, org_unit_id, phone_number } = employee

          // Validate required fields
          if (!full_name || !email || !org_unit_id) {
            errors.push({
              employee_id: employee_id || '',
              email: email || '',
              error: 'Missing required fields (full_name, email, org_unit_id)',
            })
            failed++
            continue
          }

          // Check if employee already exists in this company
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('company_id', companyId)
            .or(`email.eq.${email},employee_id.eq.${employee_id || 'null'}`)
            .maybeSingle()

          if (existingProfile) {
            // Employee exists
            if (options.onDuplicate === 'skip') {
              skipped++
              continue
            }

            // Update existing profile
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                full_name,
                org_unit_id,
                employee_id: employee_id || null,
                phone_number: phone_number || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingProfile.id)

            if (updateError) {
              errors.push({
                employee_id,
                email,
                error: `Failed to update: ${updateError.message}`,
              })
              failed++
            } else {
              updated++
            }
          } else {
            // Create new employee
            if (options.createAuthUsers) {
              // Create Supabase Auth user with email
              // Note: This requires admin privileges and proper email configuration
              // For now, we'll create the profile without auth user
              // In production, you'd use Supabase Admin API or invite flow

              // Generate a random password (user will reset via magic link)
              const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12)

              // Create auth user (this needs service role key)
              // For now, skip auth creation and just create profile
              // In Phase 3, we'll use magic link invitations

              const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                  id: crypto.randomUUID(),
                  company_id: companyId,
                  employee_id,
                  full_name,
                  email,
                  phone_number,
                  org_unit_id,
                  role: 'employee',
                  invitation_status: 'pending',
                  auth_method: phone_number ? 'both' : 'email',
                })

              if (profileError) {
                // Check if it's a duplicate key error
                if (profileError.code === '23505') {
                  // Duplicate - this shouldn't happen as we checked above, but handle it
                  if (options.onDuplicate === 'skip') {
                    skipped++
                  } else {
                    errors.push({
                      employee_id,
                      email,
                      error: 'Duplicate employee detected during insert',
                    })
                    failed++
                  }
                } else {
                  errors.push({
                    employee_id,
                    email,
                    error: `Failed to create profile: ${profileError.message}`,
                  })
                  failed++
                }
              } else {
                created++
              }
            } else {
              // Just create profile without auth user
              const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                  id: crypto.randomUUID(),
                  company_id: companyId,
                  employee_id,
                  full_name,
                  email,
                  phone_number,
                  org_unit_id,
                  role: 'employee',
                  invitation_status: 'pending',
                  auth_method: phone_number ? 'both' : 'email',
                })

              if (profileError) {
                if (profileError.code === '23505') {
                  if (options.onDuplicate === 'skip') {
                    skipped++
                  } else {
                    errors.push({
                      employee_id,
                      email,
                      error: 'Duplicate employee detected during insert',
                    })
                    failed++
                  }
                } else {
                  errors.push({
                    employee_id,
                    email,
                    error: `Failed to create profile: ${profileError.message}`,
                  })
                  failed++
                }
              } else {
                created++
              }
            }
          }
        } catch (err) {
          errors.push({
            employee_id: employee.employee_id || '',
            email: employee.email || '',
            error: err instanceof Error ? err.message : 'Unknown error',
          })
          failed++
        }
      }
    }

    return NextResponse.json({
      success: true,
      results: {
        created,
        updated,
        skipped,
        failed,
        errors: errors.slice(0, 100), // Limit to first 100 errors
      },
    })

  } catch (error) {
    console.error('Bulk import error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import employees',
      },
      { status: 500 }
    )
  }
}
