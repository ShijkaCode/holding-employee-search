# Employee Import Template

## Required Columns

The Excel file must contain the following columns:

### Mandatory Fields:
1. **full_name** (or name, нэр, овог нэр) - Employee's full name
2. **email** (or e-mail, имэйл, цахим шуудан) - Employee's email address
3. **org_unit_name** (or department, dept, хэлтэс, нэгж, судалгааны бүлэглэлийн нэр) - Organization unit name

### Optional Fields:
4. **employee_id** (or emp_id, id, таны код) - Employee's unique ID
5. **phone_number** (or phone, mobile, утас) - Phone number in E.164 format (+976XXXXXXXX)

## Excel Format Example

| full_name | email | employee_id | org_unit_name | phone_number |
|-----------|-------|-------------|---------------|--------------|
| John Doe | john@company.com | EMP001 | Sales Department | +97699123456 |
| Jane Smith | jane@company.com | EMP002 | Marketing Team | +97699123457 |
| Баяр Доржийн | bayar@company.com | EMP003 | Борлуулалт | +97699123458 |

## Hierarchical Organization Structure

For N-level organizational hierarchy, you can include multiple columns representing different levels:

| full_name | email | Division | Department | Team | Unit |
|-----------|-------|----------|------------|------|------|
| John Doe | john@company.com | Sales | Enterprise | Team A | Unit 1 |
| Jane Smith | jane@company.com | Marketing | Digital | Team B | Unit 2 |

The system will automatically create the organizational hierarchy based on these columns during the import mapping step.

## Validation Rules

### Email Validation:
- Must be a valid RFC 5322 email format
- Domain must have valid MX records (checked server-side)
- Cannot be duplicate within the file
- Maximum length: 254 characters

### Name Validation:
- Required field
- Must not be empty

### Organization Unit:
- Required field
- Will be mapped to existing units or created during import
- Supports N-level hierarchy

### Employee ID:
- Optional but recommended for tracking
- Must be unique within the company
- Used for duplicate detection during updates

### Phone Number:
- Optional (for Phase 4 SMS feature)
- Should be in E.164 format: +[country code][number]
- Example for Mongolia: +97699123456

## Import Process

1. **Upload**: Upload your Excel file (.xlsx or .xls, max 10MB)
2. **Validation**: System validates emails with MX lookup and checks for duplicates
3. **Mapping**: Map Excel columns to system fields and organizational hierarchy
4. **Preview**: Review the data structure and validation results
5. **Import**: System creates/updates employee profiles and org units

## Duplicate Handling

If an employee with the same email or employee_id already exists:
- **Skip**: Keep existing data, skip the import row
- **Update**: Update existing employee with new information

## Maximum Limits

- **File Size**: 10 MB
- **Rows**: 10,000 employees per import
- **Columns**: Unlimited

## Tips for Successful Import

1. **Clean Data**: Remove empty rows and ensure consistent formatting
2. **Valid Emails**: Use company email addresses with verified domains
3. **Unique IDs**: Ensure employee_id values are unique
4. **Hierarchy**: Keep organizational names consistent (e.g., don't mix "Sales Dept" and "Sales Department")
5. **Test First**: Try importing a small sample (10-20 rows) before importing thousands

## Common Issues

### "Domain does not accept emails (no MX records)"
- The email domain is invalid or doesn't have mail servers configured
- Verify the email addresses are correct
- Contact IT to verify domain MX records

### "Duplicate email in file"
- The same email appears multiple times in your Excel file
- Remove or correct duplicate entries

### "Missing required column"
- Your Excel doesn't have the required column headers
- Ensure at least full_name, email, and org_unit_name columns exist

## Support

For help with imports, contact your system administrator or HR department.
