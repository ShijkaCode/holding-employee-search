
-- Fix Infinite Recursion in RLS Policies

-- 1. Drop existing problematic policies
DROP POLICY IF EXISTS "surveys_select_hr" ON surveys;
DROP POLICY IF EXISTS "surveys_select_specialist" ON surveys;
DROP POLICY IF EXISTS "surveys_admin_all" ON surveys;
DROP POLICY IF EXISTS "surveys_employee_select" ON surveys;

DROP POLICY IF EXISTS "assignments_select_employee" ON survey_assignments;
DROP POLICY IF EXISTS "assignments_select_hr" ON survey_assignments;

-- 2. Ensure Helper Functions are Security Definer and Safe
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

-- 3. Re-create SURVEYS Policies

-- Admin: Full Access
CREATE POLICY "surveys_admin_all"
  ON surveys FOR ALL
  USING (get_user_role() = 'admin');

-- Specialist: Holding surveys only
CREATE POLICY "surveys_select_specialist"
  ON surveys FOR SELECT
  USING (
    get_user_role() = 'specialist'
    AND scope = 'holding'
  );

-- HR: Company surveys + Active Holding surveys (Read Only)
CREATE POLICY "surveys_select_hr"
  ON surveys FOR SELECT
  USING (
    get_user_role() = 'hr'
    AND (
      (scope = 'holding' AND status = 'active' AND company_id = get_user_company_id())
      OR
      (scope = 'company' AND company_id = get_user_company_id())
    )
  );

-- HR: Create/Update Company surveys only
CREATE POLICY "surveys_insert_hr"
  ON surveys FOR INSERT
  WITH CHECK (
    get_user_role() = 'hr'
    AND scope = 'company'
    AND company_id = get_user_company_id()
  );

CREATE POLICY "surveys_update_hr"
  ON surveys FOR UPDATE
  USING (
    get_user_role() = 'hr'
    AND scope = 'company'
    AND company_id = get_user_company_id()
  );

-- Employee: See assigned surveys
-- This is allowed ONLY if survey_assignments policy is clean
CREATE POLICY "surveys_select_employee"
  ON surveys FOR SELECT
  USING (
    id IN (
      SELECT survey_id 
      FROM survey_assignments 
      WHERE employee_id = auth.uid()
    )
  );

-- 4. Re-create SURVEY ASSIGNMENTS Policies (Crucial Step)

-- Employee: See own assignments (SIMPLE, NON-RECURSIVE)
-- We DO NOT check surveys table here to avoid the loop
CREATE POLICY "assignments_select_employee"
  ON survey_assignments FOR SELECT
  USING (employee_id = auth.uid());

-- HR: See assignments for their company's employees
-- We link to profiles to check company_id, NOT surveys
CREATE POLICY "assignments_select_hr"
  ON survey_assignments FOR SELECT
  USING (
    get_user_role() = 'hr'
    AND employee_id IN (
      SELECT id FROM profiles WHERE company_id = get_user_company_id()
    )
  );

-- Admin/Specialist: See all
CREATE POLICY "assignments_select_admin_specialist"
  ON survey_assignments FOR SELECT
  USING (
    get_user_role() IN ('admin', 'specialist')
  );
