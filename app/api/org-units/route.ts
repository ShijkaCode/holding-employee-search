import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - List org units for a company
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get company_id from query or use user's company
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('company_id')

    // Only admin can query other companies
    const targetCompanyId = companyId && profile.role === 'admin' ? companyId : profile.company_id

    if (!targetCompanyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
    }

    // Fetch org units
    const { data: orgUnits, error } = await supabase
      .from('org_units')
      .select('id, name, parent_id, level_type, level_depth')
      .eq('company_id', targetCompanyId)
      .order('level_depth')
      .order('name')

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, data: orgUnits || [] })

  } catch (error) {
    console.error('Error fetching org units:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch org units' },
      { status: 500 }
    )
  }
}

// POST - Create new org unit
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile and verify role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'hr'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { name, parent_id, level_type, level_depth } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Determine company_id (admin can specify, HR uses their own)
    const companyId = profile.role === 'admin' && body.company_id
      ? body.company_id
      : profile.company_id

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
    }

    // If parent_id provided, verify it exists in same company
    if (parent_id) {
      const { data: parentUnit } = await supabase
        .from('org_units')
        .select('id, company_id, level_depth')
        .eq('id', parent_id)
        .single()

      if (!parentUnit || parentUnit.company_id !== companyId) {
        return NextResponse.json({ error: 'Invalid parent org unit' }, { status: 400 })
      }
    }

    // Check for duplicate (same name in same company - company-wide unique)
    const { data: existing } = await supabase
      .from('org_units')
      .select('id')
      .eq('company_id', companyId)
      .eq('name', name)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Энэ нэртэй нэгж аль хэдийн байна' },
        { status: 400 }
      )
    }

    // Calculate level_depth if not provided
    let calculatedDepth = level_depth
    if (calculatedDepth === undefined || calculatedDepth === null) {
      if (parent_id) {
        // Get parent's depth and add 1
        const { data: parentUnit } = await supabase
          .from('org_units')
          .select('level_depth')
          .eq('id', parent_id)
          .single()

        calculatedDepth = (parentUnit?.level_depth ?? 0) + 1
      } else {
        calculatedDepth = 0 // Root level
      }
    }

    // Create org unit
    const { data: newUnit, error: insertError } = await supabase
      .from('org_units')
      .insert({
        company_id: companyId,
        name,
        parent_id: parent_id || null,
        level_type: level_type || `Level ${calculatedDepth + 1}`,
        level_depth: calculatedDepth,
      })
      .select('id, name, parent_id, level_type, level_depth')
      .single()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({
      success: true,
      data: newUnit,
      message: 'Org unit created successfully',
    })

  } catch (error) {
    console.error('Error creating org unit:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create org unit' },
      { status: 500 }
    )
  }
}
