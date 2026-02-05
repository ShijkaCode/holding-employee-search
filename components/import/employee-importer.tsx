'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { Upload, GitBranch, Eye, Play, CheckCircle2, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { UploadStep, type ParsedExcelData } from './upload-step'
import { MappingStep, type ImportConfig, type ColumnMapping } from './mapping-step'
import { PreviewStep } from './preview-step'
import type { SupabaseClient } from '@supabase/supabase-js'

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete'

interface ImportResult {
  orgUnitsCreated: number
  employeesCreated: number
  employeesUpdated: number
  errors: { row: number; message: string }[]
}

interface EmployeeImporterProps {
  companyId: string
  onComplete?: () => void
}

// Helper function to find or create org unit
async function findOrCreateOrgUnit(
  supabase: SupabaseClient,
  companyId: string,
  name: string,
  parentId: string | null,
  levelType: string,
  levelDepth: number,
  cache: Map<string, string>,
  cachePath: string
): Promise<{ id: string; created: boolean }> {
  // Check cache first
  if (cache.has(cachePath)) {
    return { id: cache.get(cachePath)!, created: false }
  }

  // Query for existing unit
  let existingId: string | null = null

  if (parentId === null) {
    const { data } = await supabase
      .from('org_units')
      .select('id')
      .eq('company_id', companyId)
      .eq('name', name)
      .is('parent_id', null)
      .maybeSingle()
    existingId = data?.id ?? null
  } else {
    const { data } = await supabase
      .from('org_units')
      .select('id')
      .eq('company_id', companyId)
      .eq('name', name)
      .eq('parent_id', parentId)
      .maybeSingle()
    existingId = data?.id ?? null
  }

  if (existingId) {
    cache.set(cachePath, existingId)
    return { id: existingId, created: false }
  }

  // Create new unit
  const { data: newUnit, error } = await supabase
    .from('org_units')
    .insert({
      company_id: companyId,
      parent_id: parentId,
      name: name,
      level_type: levelType,
      level_depth: levelDepth,
    })
    .select('id')
    .single()

  if (error || !newUnit) {
    throw new Error(`Failed to create org unit: ${error?.message || 'Unknown error'}`)
  }

  cache.set(cachePath, newUnit.id)
  return { id: newUnit.id, created: true }
}

export function EmployeeImporter({ companyId, onComplete }: EmployeeImporterProps) {
  const [step, setStep] = useState<Step>('upload')
  const [excelData, setExcelData] = useState<ParsedExcelData | null>(null)
  const [config, setConfig] = useState<ImportConfig | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const t = useTranslations('Import')
  const supabase = createClient()

  const steps = [
    { id: 'upload', label: t('steps.upload'), icon: Upload },
    { id: 'mapping', label: t('steps.mapping'), icon: GitBranch },
    { id: 'preview', label: t('steps.preview'), icon: Eye },
    { id: 'importing', label: t('steps.import'), icon: Play },
  ]

  const currentStepIndex = steps.findIndex(s => s.id === step)

  const handleExcelParsed = useCallback((data: ParsedExcelData) => {
    setExcelData(data)
    setStep('mapping')
  }, [])

  const handleConfigChange = useCallback((newConfig: ImportConfig) => {
    setConfig(newConfig)
    setStep('preview')
  }, [])

  const handleBack = useCallback(() => {
    if (step === 'mapping') setStep('upload')
    else if (step === 'preview') setStep('mapping')
  }, [step])

  const runImport = useCallback(async () => {
    if (!excelData || !config) return

    setStep('importing')
    setImportProgress(0)

    try {
      // ✅ NEW: Use Server Action instead of client-side loop
      const { importEmployeesWithHierarchy } = await import('@/lib/actions/employees-import')

      // Helper to get mapping
      const getMapping = (target: string): string | undefined => {
        const mapping = config.mappings.find(m => m.targetField === target)
        return mapping?.sourceColumn
      }

      const getHierarchyMappings = (): ColumnMapping[] => {
        return config.mappings
          .filter(m => m.targetField.startsWith('hierarchy_'))
          .sort((a, b) => {
            const aLevel = parseInt(a.targetField.split('_')[1])
            const bLevel = parseInt(b.targetField.split('_')[1])
            return aLevel - bLevel
          })
      }

      const nameColumn = getMapping('name')
      const emailColumn = getMapping('email')
      const employeeIdColumn = getMapping('employee_id')
      const phoneColumn = getMapping('phone_number')
      const hierarchyMappings = getHierarchyMappings()

      // Transform data for Server Action
      const employeesToImport = excelData.rows.map((row, index) => {
        const org_hierarchy = hierarchyMappings.map(mapping => {
          const levelNum = parseInt(mapping.targetField.split('_')[1])
          const levelConfig = config.hierarchyLevels.find(l => l.level === levelNum)

          return {
            level: levelNum,
            levelType: levelConfig?.levelType || `Level ${levelNum}`,
            name: row.data[mapping.sourceColumn]?.trim() || '',
            parentId: null, // Will be calculated server-side
          }
        }).filter(h => h.name) // Remove empty levels

        return {
          rowNumber: index + 2, // Excel row number (1-indexed + header)
          full_name: nameColumn ? row.data[nameColumn] : '',
          email: emailColumn ? row.data[emailColumn] : '',
          employee_id: employeeIdColumn ? row.data[employeeIdColumn] : undefined,
          phone_number: phoneColumn ? row.data[phoneColumn] : undefined,
          org_hierarchy,
        }
      }).filter(emp => emp.full_name && emp.email) // Only import rows with required data

      setImportProgress(50)

      // Call Server Action - creates auth users + profiles
      const result = await importEmployeesWithHierarchy(
        employeesToImport,
        companyId,
        true // ✅ Create auth users so they can login via magic links!
      )

      setImportProgress(100)
      setImportResult(result)
      setStep('complete')

      if (result.errors.length === 0) {
        toast.success(t('messages.success'))
      } else {
        toast.warning(t('messages.partial'))
      }

    } catch (error) {
      console.error('Import failed:', error)
      toast.error(t('messages.failed'))
      setStep('preview')
    }
  }, [excelData, config, companyId, t])

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center">
        {steps.map((s, index) => (
          <div key={s.id} className="flex items-center">
            <div
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full transition-colors',
                index <= currentStepIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <s.icon className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-12 h-0.5 mx-2',
                  index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === 'upload' && (
        <UploadStep onDataParsed={handleExcelParsed} existingData={excelData} />
      )}

      {step === 'mapping' && excelData && (
        <>
          <MappingStep
            excelData={excelData}
            onConfigChange={handleConfigChange}
            existingConfig={config}
          />
          <div className="flex justify-start">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('back')}
            </Button>
          </div>
        </>
      )}

      {step === 'preview' && excelData && config && (
        <>
          <PreviewStep excelData={excelData} config={config} />
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('back')}
            </Button>
            <Button onClick={runImport}>
              <Play className="mr-2 h-4 w-4" />
              {t('startImport')}
            </Button>
          </div>
        </>
      )}

      {step === 'importing' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h3 className="text-lg font-medium">{t('importing')}</h3>
              <Progress value={importProgress} className="w-64" />
              <p className="text-sm text-muted-foreground">{importProgress}%</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'complete' && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              {t('complete.title')}
            </CardTitle>
            <CardDescription>{t('complete.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold text-green-600">{importResult.orgUnitsCreated}</p>
                <p className="text-sm text-muted-foreground">{t('complete.unitsCreated')}</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{importResult.employeesUpdated}</p>
                <p className="text-sm text-muted-foreground">{t('complete.employeesUpdated')}</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold text-amber-600">{importResult.errors.length}</p>
                <p className="text-sm text-muted-foreground">{t('complete.errors')}</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="border rounded-lg p-4 mb-6 max-h-48 overflow-auto">
                <p className="font-medium mb-2 text-destructive">{t('complete.errorDetails')}</p>
                <div className="space-y-1 text-sm">
                  {importResult.errors.slice(0, 20).map((err, i) => (
                    <p key={i}>
                      <span className="font-mono text-muted-foreground">{t('row', { n: err.row })}:</span>{' '}
                      {err.message}
                    </p>
                  ))}
                  {importResult.errors.length > 20 && (
                    <p className="text-muted-foreground">
                      +{importResult.errors.length - 20} {t('moreErrors')}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={onComplete}>
                {t('complete.done')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
