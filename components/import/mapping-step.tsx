'use client'

import { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ParsedExcelData } from './upload-step'

export type MappingTarget =
  | 'name'
  | 'email'
  | 'employee_id'
  | 'hierarchy_1'
  | 'hierarchy_2'
  | 'hierarchy_3'
  | 'hierarchy_4'
  | 'hierarchy_5'
  | 'skip'

export interface ColumnMapping {
  sourceColumn: string
  targetField: MappingTarget
  levelType?: string
}

export interface ImportConfig {
  mappings: ColumnMapping[]
  hierarchyLevels: { level: number; levelType: string }[]
}

interface MappingStepProps {
  excelData: ParsedExcelData
  onConfigChange: (config: ImportConfig) => void
  existingConfig?: ImportConfig | null
}

const LEVEL_TYPE_PRESETS = [
  'Division',
  'Department',
  'Team',
  'Group',
  'Unit',
  'Газар',
  'Алба',
  'Хэлтэс',
  'Баг',
  'Тасаг',
]

const FIELD_OPTIONS: { value: MappingTarget; labelKey: string }[] = [
  { value: 'skip', labelKey: 'skip' },
  { value: 'name', labelKey: 'employeeName' },
  { value: 'email', labelKey: 'email' },
  { value: 'employee_id', labelKey: 'employeeId' },
  { value: 'hierarchy_1', labelKey: 'hierarchyLevel1' },
  { value: 'hierarchy_2', labelKey: 'hierarchyLevel2' },
  { value: 'hierarchy_3', labelKey: 'hierarchyLevel3' },
  { value: 'hierarchy_4', labelKey: 'hierarchyLevel4' },
  { value: 'hierarchy_5', labelKey: 'hierarchyLevel5' },
]

export function MappingStep({ excelData, onConfigChange, existingConfig }: MappingStepProps) {
  const t = useTranslations('Import')

  // Initialize mappings from existing config or create defaults
  const [mappings, setMappings] = useState<ColumnMapping[]>(() => {
    if (existingConfig?.mappings) {
      return existingConfig.mappings
    }
    // Auto-detect common column names
    return excelData.headers.map(header => {
      const lowerHeader = header.toLowerCase()
      let targetField: MappingTarget = 'skip'

      if (lowerHeader.includes('name') || lowerHeader.includes('нэр')) {
        targetField = 'name'
      } else if (lowerHeader.includes('email') || lowerHeader.includes('имэйл')) {
        targetField = 'email'
      } else if (lowerHeader.includes('id') || lowerHeader.includes('код')) {
        targetField = 'employee_id'
      }

      return {
        sourceColumn: header,
        targetField,
      }
    })
  })

  const [hierarchyLevels, setHierarchyLevels] = useState<{ level: number; levelType: string }[]>(
    existingConfig?.hierarchyLevels || [
      { level: 1, levelType: 'Division' },
      { level: 2, levelType: 'Department' },
      { level: 3, levelType: 'Team' },
    ]
  )

  // Update parent config when mappings or levels change
  const updateConfig = useCallback(() => {
    onConfigChange({
      mappings,
      hierarchyLevels,
    })
  }, [mappings, hierarchyLevels, onConfigChange])

  const handleMappingChange = useCallback((index: number, field: 'targetField' | 'levelType', value: string) => {
    setMappings(prev => {
      const updated = [...prev]
      if (field === 'targetField') {
        updated[index] = { ...updated[index], targetField: value as MappingTarget }
      } else {
        updated[index] = { ...updated[index], levelType: value }
      }
      return updated
    })
  }, [])

  const handleLevelTypeChange = useCallback((level: number, levelType: string) => {
    setHierarchyLevels(prev => {
      const existing = prev.find(l => l.level === level)
      if (existing) {
        return prev.map(l => l.level === level ? { ...l, levelType } : l)
      } else {
        return [...prev, { level, levelType }].sort((a, b) => a.level - b.level)
      }
    })
  }, [])

  // Get sample values for each column
  const getSampleValues = useCallback((column: string): string[] => {
    const values = new Set<string>()
    for (const row of excelData.rows.slice(0, 10)) {
      const val = row[column]
      if (val) values.add(val)
      if (values.size >= 3) break
    }
    return Array.from(values)
  }, [excelData.rows])

  // Calculate which hierarchy levels are being used
  const usedHierarchyLevels = useMemo(() => {
    const levels = new Set<number>()
    mappings.forEach(m => {
      const match = m.targetField.match(/^hierarchy_(\d)$/)
      if (match) {
        levels.add(parseInt(match[1]))
      }
    })
    return Array.from(levels).sort()
  }, [mappings])

  // Validation
  const hasNameMapping = mappings.some(m => m.targetField === 'name')
  const hasHierarchyMapping = usedHierarchyLevels.length > 0

  return (
    <div className="space-y-6">
      {/* Column Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('columnMapping')}</CardTitle>
          <CardDescription>{t('columnMappingDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mappings.map((mapping, index) => (
              <div key={mapping.sourceColumn} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

                {/* Source Column */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{mapping.sourceColumn}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {getSampleValues(mapping.sourceColumn).join(', ') || t('noData')}
                  </p>
                </div>

                {/* Arrow */}
                <span className="text-muted-foreground shrink-0">→</span>

                {/* Target Field */}
                <div className="w-48 shrink-0">
                  <Select
                    value={mapping.targetField}
                    onValueChange={(value) => handleMappingChange(index, 'targetField', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(`fields.${opt.labelKey}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          {/* Validation Messages */}
          <div className="mt-4 space-y-2">
            {!hasNameMapping && (
              <p className="text-sm text-destructive">
                {t('validation.nameRequired')}
              </p>
            )}
            {!hasHierarchyMapping && (
              <p className="text-sm text-amber-600">
                {t('validation.hierarchyRecommended')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hierarchy Level Types */}
      {usedHierarchyLevels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('hierarchyLevels')}</CardTitle>
            <CardDescription>{t('hierarchyLevelsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {usedHierarchyLevels.map(level => {
                const levelConfig = hierarchyLevels.find(l => l.level === level)
                return (
                  <div key={level} className="flex items-center gap-4">
                    <Badge variant="outline" className="w-24 justify-center">
                      {t('level', { n: level })}
                    </Badge>
                    <div className="flex-1">
                      <Input
                        placeholder={t('levelTypePlaceholder')}
                        value={levelConfig?.levelType || ''}
                        onChange={(e) => handleLevelTypeChange(level, e.target.value)}
                      />
                    </div>
                  </div>
                )
              })}

              {/* Presets */}
              <div className="pt-2">
                <Label className="text-sm text-muted-foreground">{t('presets')}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {LEVEL_TYPE_PRESETS.map(preset => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        // Apply preset to first empty level
                        const emptyLevel = usedHierarchyLevels.find(
                          l => !hierarchyLevels.find(h => h.level === l)?.levelType
                        )
                        if (emptyLevel) {
                          handleLevelTypeChange(emptyLevel, preset)
                        }
                      }}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Continue Button */}
      <div className="flex justify-end">
        <Button
          onClick={updateConfig}
          disabled={!hasNameMapping}
        >
          {t('continueToPreview')}
        </Button>
      </div>
    </div>
  )
}
