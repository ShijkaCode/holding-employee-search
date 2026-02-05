import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { validateEmails, isValidEmailFormat } from '@/lib/validation/email'

export const maxDuration = 60 // 60 seconds for large files

// ✅ SIMPLIFIED: Removed warnings tracking (YAGNI)
interface ParsedRow {
  rowNumber: number
  employee_id: string
  full_name: string
  email: string
  org_unit_name: string
  phone_number?: string
  errors: string[]
}

interface ParseResult {
  success: boolean
  data?: {
    rows: ParsedRow[]
    summary: {
      total: number
      valid: number
      invalid: number
      duplicates: number
    }
    orgUnits: string[]
    columns: string[]
  }
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<ParseResult>> {
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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({ success: false, error: 'Invalid file format. Please upload .xlsx or .xls file' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File too large. Maximum size is 10MB' }, { status: 400 })
    }

    // Parse Excel file
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    // Get first sheet
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    }) as unknown[][]

    if (jsonData.length < 2) {
      return NextResponse.json({ success: false, error: 'Excel file is empty or has no data rows' }, { status: 400 })
    }

    // ✅ SIMPLIFIED: Require exact column names (YAGNI - removed flexible matching)
    // Extract headers
    const headers = (jsonData[0] as string[]).map((h) => String(h || '').trim())

    // Required exact column names
    const REQUIRED_COLUMNS = {
      full_name: 'full_name',
      email: 'email',
      employee_id: 'employee_id',
      org_unit_name: 'org_unit_name',
    } as const

    const OPTIONAL_COLUMNS = {
      phone_number: 'phone_number',
    } as const

    // Check required columns exist
    const missingColumns = Object.values(REQUIRED_COLUMNS).filter(
      col => !headers.includes(col)
    )

    if (missingColumns.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Missing required columns: ${missingColumns.join(', ')}. Excel must have exact column names: ${Object.values(REQUIRED_COLUMNS).join(', ')}`
      }, { status: 400 })
    }

    const nameCol = REQUIRED_COLUMNS.full_name
    const emailCol = REQUIRED_COLUMNS.email
    const employeeIdCol = REQUIRED_COLUMNS.employee_id
    const orgUnitCol = REQUIRED_COLUMNS.org_unit_name
    const phoneCol = OPTIONAL_COLUMNS.phone_number

    // ✅ SIMPLIFIED: Removed duplicate tracking (YAGNI - database handles this)
    const parsedRows: ParsedRow[] = []
    const orgUnitsSet = new Set<string>()

    // Collect all emails for batch validation
    const allEmails: string[] = []
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as unknown[]
      if (!row || row.every(v => !v || String(v).trim() === '')) {
        continue // Skip empty rows
      }

      const emailIdx = emailCol ? headers.indexOf(emailCol) : -1
      if (emailIdx >= 0) {
        const email = String(row[emailIdx] || '').trim()
        if (email) allEmails.push(email)
      }
    }

    // Validate all emails with MX lookup (batched by domain)
    const emailValidation = await validateEmails(allEmails)

    // Process each row
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as unknown[]
      const rowNumber = i + 1 // Excel row number (1-indexed, +1 for header)

      // Skip completely empty rows
      if (!row || row.every(v => !v || String(v).trim() === '')) {
        continue
      }

      const nameIdx = headers.indexOf(nameCol)
      const emailIdx = headers.indexOf(emailCol)
      const employeeIdIdx = headers.indexOf(employeeIdCol)
      const orgUnitIdx = headers.indexOf(orgUnitCol)
      const phoneIdx = headers.indexOf(phoneCol)

      const full_name = String(row[nameIdx] || '').trim()
      const email = String(row[emailIdx] || '').trim()
      const employee_id = String(row[employeeIdIdx] || '').trim()
      const org_unit_name = String(row[orgUnitIdx] || '').trim()
      const phone_number = phoneIdx >= 0 ? String(row[phoneIdx] || '').trim() : undefined

      const errors: string[] = []

      // Validate required fields
      if (!full_name) {
        errors.push('Missing full name')
      }

      if (!email && !phone_number) {
        errors.push('Missing email or phone number')
      }

      if (!org_unit_name) {
        errors.push('Missing org unit name')
      }

      // ✅ SIMPLIFIED: Basic email validation only (MX check kept for actual invalid domains)
      if (email) {
        if (!isValidEmailFormat(email)) {
          errors.push('Invalid email format')
        } else {
          const validation = emailValidation.get(email)
          if (validation && !validation.valid) {
            errors.push(`Email validation failed: ${validation.error}`)
          }
        }
      }

      // Collect org units
      if (org_unit_name) {
        orgUnitsSet.add(org_unit_name)
      }

      parsedRows.push({
        rowNumber,
        employee_id,
        full_name,
        email,
        org_unit_name,
        phone_number,
        errors,
      })
    }

    // ✅ SIMPLIFIED: Basic summary only
    const valid = parsedRows.filter(r => r.errors.length === 0).length
    const invalid = parsedRows.length - valid

    return NextResponse.json({
      success: true,
      data: {
        rows: parsedRows,
        summary: {
          total: parsedRows.length,
          valid,
          invalid,
          duplicates: 0, // Database will handle duplicates
        },
        orgUnits: Array.from(orgUnitsSet).sort(),
        columns: headers,
      },
    })

  } catch (error) {
    console.error('Error parsing Excel:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse Excel file',
      },
      { status: 500 }
    )
  }
}
