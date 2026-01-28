'use client'

import { useRouter } from '@/i18n/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/auth-context'
import { EmployeeImporter } from '@/components/import'
import { Link } from '@/i18n/navigation'

export default function ImportPage() {
  const router = useRouter()
  const { profile, authState } = useAuth()
  const t = useTranslations('Import')

  const handleComplete = () => {
    router.push('/employees')
  }

  if (authState === 'UNINITIALIZED' || authState === 'CHECKING_SESSION') {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!profile?.company_id) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-8">
              No company associated with your profile
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/employees">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {/* Importer */}
      <EmployeeImporter
        companyId={profile.company_id}
        onComplete={handleComplete}
      />
    </div>
  )
}
