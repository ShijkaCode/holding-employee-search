# Employee Feedback System / Ажилтны санал асуулгын систем

A multi-tenant employee feedback and survey management system designed for holding companies with multiple subsidiaries.

Холдинг компаниудад зориулсан олон салбар дэмжих ажилтны санал асуулга, судалгааны удирдлагын систем.

## Tech Stack / Технологи

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **UI Components**: Shadcn/ui, Tailwind CSS, Lucide Icons
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth with Row Level Security (RLS)
- **Form Handling**: React Hook Form + Zod validation

## Features / Онцлогууд

### Multi-tenant Architecture / Олон байгууллагын бүтэц
- Companies (holding and subsidiaries) management
- Role-based access control (admin, hr, specialist, employee)
- Data isolation per company using RLS policies

### Survey Management / Судалгааны удирдлага
- Create surveys with multiple question types:
  - Scale (1-5 Likert scale)
  - Text (open-ended)
  - Single choice
  - Multiple choice
- Section-based question organization
- Survey status workflow: Draft → Active → Closed
- Employee assignment to surveys

### Data Collection / Мэдээлэл цуглуулах
- Anonymous or identified responses
- Progress tracking (completion rate)
- Response validation

### Reporting & Export / Тайлан ба экспорт
- **CSV Export**: Full response data with UTF-8 support for Cyrillic/Mongolian
- **PDF Reports**: Printable reports with:
  - Response statistics
  - Section averages
  - Question-level analysis
  - Full Mongolian language support

## Database Schema / Өгөгдлийн сангийн бүтэц

```
companies
├── id (uuid, PK)
├── name
├── parent_id (self-reference for holding structure)
└── created_at

profiles (extends Supabase auth.users)
├── id (uuid, PK, FK → auth.users)
├── email
├── full_name
├── role (admin | hr | specialist | employee)
├── company_id (FK → companies)
├── department
└── created_at

surveys
├── id (uuid, PK)
├── title
├── description
├── company_id (FK → companies)
├── status (draft | active | closed)
├── created_by (FK → profiles)
└── created_at

survey_questions
├── id (uuid, PK)
├── survey_id (FK → surveys)
├── question_code
├── question_text
├── type (scale | text | single_choice | multiple_choice)
├── section_name
├── section_order
├── question_order
└── options (jsonb, for choice questions)

survey_assignments
├── id (uuid, PK)
├── survey_id (FK → surveys)
├── employee_id (FK → profiles)
└── assigned_at

survey_responses
├── id (uuid, PK)
├── survey_id (FK → surveys)
├── employee_id (FK → profiles)
├── answers (jsonb)
├── status (in_progress | completed)
└── submitted_at
```

## User Roles / Хэрэглэгчийн үүргүүд

| Role | Permissions |
|------|-------------|
| **admin** | Full system access, company management |
| **hr** | Survey management, view all responses, export data |
| **specialist** | Create and manage own surveys |
| **employee** | Fill assigned surveys |

## Getting Started / Эхлүүлэх

### Prerequisites / Урьдчилсан шаардлага

- Node.js 18+
- npm or yarn
- Supabase account

### Installation / Суулгах

1. Clone the repository:
```bash
git clone <repository-url>
cd holding-employee-feedback
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Run database migrations in Supabase SQL Editor (see `supabase/migrations/`)

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

### Test Accounts / Тест хэрэглэгчид

| Email | Password | Role |
|-------|----------|------|
| admin@test.com | test123456 | admin |
| hr@test.com | test123456 | hr |
| employee@test.com | test123456 | employee |

## Project Structure / Төслийн бүтэц

```
holding-employee-feedback/
├── app/
│   ├── (auth)/              # Auth routes (login, register)
│   │   └── login/
│   ├── (dashboard)/         # Protected dashboard routes
│   │   ├── dashboard/
│   │   ├── forms/
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx      # Survey detail/edit
│   │   │   │   ├── fill/         # Survey fill page
│   │   │   │   └── report/       # Printable report
│   │   │   └── page.tsx          # Survey list
│   │   └── layout.tsx
│   ├── api/
│   │   └── surveys/
│   │       └── [id]/
│   │           ├── export/       # CSV export
│   │           └── report-data/  # Report data API
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── ui/                  # Shadcn components
├── contexts/
│   └── auth-context.tsx     # Auth state management
├── lib/
│   ├── supabase/
│   │   ├── client.ts        # Browser Supabase client
│   │   └── server.ts        # Server Supabase client
│   └── pdf-report.ts        # PDF generation utility
└── public/
```

## Key Features Explained / Гол функцууд

### Survey Creation / Судалгаа үүсгэх
1. Navigate to Forms → Create New Survey
2. Add title and description
3. Add questions with section grouping
4. Save as draft

### Survey Distribution / Судалгаа түгээх
1. Open survey detail page
2. Click "Assign Employees" button
3. Select employees from company
4. Change status to "Active"

### Taking Surveys / Судалгаа бөглөх
1. Employee logs in
2. Views assigned surveys on dashboard
3. Fills survey and submits

### Exporting Data / Өгөгдөл экспортлох
1. HR/Admin opens survey detail
2. Click "Export CSV" button
3. Downloads CSV with all responses

### Generating Reports / Тайлан үүсгэх
1. Click "Тайлан" (Report) button
2. Print dialog opens automatically
3. Print or save as PDF

## Security / Аюулгүй байдал

- Row Level Security (RLS) policies ensure data isolation
- SECURITY DEFINER functions for safe cross-table queries
- Authentication required for all API routes
- Company-scoped data access

## License / Лиценз

MIT

## Contributing / Хувь нэмэр оруулах

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
