DO $$
DECLARE
  v_company_id uuid := '11111111-1111-1111-1111-111111111111';
  v_user_id uuid;
  v_email text;
  v_name text;
  v_dept text;
  v_emp_id text;
  i integer;
BEGIN
  -- Create pgcrypto if not exists (usually in auth schema or public)
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  FOR i IN 1..10 LOOP
    v_email := 'employee' || i || '@test.com';
    v_name := 'Test Employee ' || i;
    v_emp_id := 'EMP' || lpad((i + 1)::text, 3, '0'); -- EMP002, EMP003...
    
    IF i <= 5 THEN
      v_dept := 'HR';
    ELSE
      v_dept := 'Engineering';
    END IF;

    -- Check if user exists
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        
        -- Insert into auth.users
        INSERT INTO auth.users (
            id, 
            email, 
            encrypted_password, 
            email_confirmed_at, 
            raw_app_meta_data, 
            raw_user_meta_data, 
            created_at, 
            updated_at, 
            role, 
            aud,
            instance_id
        )
        VALUES (
            v_user_id,
            v_email,
            crypt('test123456', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', v_name),
            now(),
            now(),
            'authenticated',
            'authenticated',
            '00000000-0000-0000-0000-000000000000' -- Default instance_id
        );
        
        -- Update the profile that was created by the trigger
        -- We yield a bit to let trigger finish if async? No, triggers are sync.
        
        UPDATE public.profiles
        SET full_name = v_name,
            role = 'employee',
            company_id = v_company_id,
            department = v_dept,
            employee_id = v_emp_id,
            avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_email
        WHERE id = v_user_id;
        
    ELSE
        -- Update existing profile
        UPDATE public.profiles
        SET full_name = v_name,
            role = 'employee',
            company_id = v_company_id,
            department = v_dept,
            employee_id = v_emp_id
        WHERE id = v_user_id;
    END IF;
    
  END LOOP;
END $$;
