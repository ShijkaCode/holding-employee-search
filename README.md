# Employee Feedback System

A multi-tenant employee feedback and survey management system designed for holding companies with multiple subsidiaries.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **UI Components**: Shadcn/ui, Tailwind CSS, Lucide Icons
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth with Magic Link
- **Internationalization**: next-intl (English/Mongolian)
- **Reports**: jsPDF, xlsx

## Features

### 1. Employee Import
- Excel/CSV file upload with drag-and-drop support
- Column mapping interface for flexible data import
- Preview and validation before import
- Bulk import to organizational units
- Support for hierarchical organizational structure

### 2. Survey Invitation & Reminder Emails
- Send survey invitations via magic link (no password required)
- Bulk email sending to assigned employees
- Reminder emails for incomplete surveys
- Email templates with survey details and direct access links

### 3. Report Generation
- **CSV Export**: Full response data with UTF-8 support (Cyrillic/Mongolian)
- **PDF Reports**: Printable reports with:
  - Response statistics and completion rates
  - Section-level averages
  - Question-by-question analysis
  - Visual charts and graphs

### 4. Progress Tracking
- Real-time survey completion monitoring
- Hierarchical view by organizational unit
- Completion rates per department/company
- Status tracking (pending, in progress, completed)
- Anonymity guard for small sample sizes

### 5. Sentiment Analysis *(Planned)*
- Analyze sentiment from survey responses
- Categorize feedback as positive, negative, or neutral
- Trend analysis over time

### 6. AI-Powered Text Analysis *(Planned)*
- Automatic categorization of open-text responses
- Theme extraction and summarization
- Key insight identification

## System Architecture

### Multi-tenant Structure
- Holding company with 30-40 subsidiary companies
- N-level organizational hierarchy support
- Data isolation per company using Row Level Security (RLS)

### User Roles

| Role | Access |
|------|--------|
| **Admin** | Full system access, company management, all reports |
| **Specialist** | Create surveys, send to all companies, view aggregate analytics |
| **HR** | Company-level surveys, employee management, company reports |
| **Employee** | Fill assigned surveys |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

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

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@example.com
```

4. Run database migrations (in Supabase SQL Editor or using CLI)

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
holding-employee-feedback/
├── app/
│   ├── [locale]/
│   │   ├── (auth)/           # Login, signup, magic-link
│   │   ├── (dashboard)/      # Protected routes
│   │   │   ├── admin/        # Company & user management
│   │   │   ├── employees/    # Employee list & import
│   │   │   ├── forms/        # Survey CRUD & reports
│   │   │   └── surveys/      # Survey filling
│   │   └── auth/             # Magic link verification
│   └── api/
│       ├── auth/             # Magic link validation
│       ├── employees/        # Import APIs
│       ├── org-units/        # Organization structure
│       └── surveys/          # Export, invitations, reminders
├── components/
│   ├── import/               # Employee importer components
│   ├── org-units/            # Org tree visualization
│   ├── survey/               # Survey & progress tracking
│   └── ui/                   # Shadcn components
├── lib/
│   ├── email/                # Email templates & sending
│   ├── supabase/             # Database clients
│   └── pdf-report.ts         # PDF generation
└── messages/                 # i18n translations
```

## Security

- Row Level Security (RLS) policies for data isolation
- Magic link authentication (passwordless)
- Company-scoped data access
- SECURITY DEFINER functions for safe cross-table queries

## License

MIT
