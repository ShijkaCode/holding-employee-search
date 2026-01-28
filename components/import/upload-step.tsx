'use client'

import { useCallback, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Upload, FileSpreadsheet, X, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useTranslations } from 'next-intl'

export interface ParsedExcelData {
  headers: string[]
  rows: Record<string, string>[]
  fileName: string
  sheetName: string
}

interface UploadStepProps {
  onDataParsed: (data: ParsedExcelData) => void
  existingData?: ParsedExcelData | null
}

export function UploadStep({ onDataParsed, existingData }: UploadStepProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedExcelData | null>(existingData || null)

  const t = useTranslations('Import')

  const parseExcelFile = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })

      // Get first sheet
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]

      // Convert to JSON with headers (header: 1 returns array of arrays)
      const jsonData = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
      }) as unknown[][]

      if (jsonData.length < 2) {
        throw new Error(t('errors.noData'))
      }

      // First row is headers
      const headers = (jsonData[0] as string[]).map((h, i) =>
        String(h || `Column ${i + 1}`).trim()
      )

      // Rest are data rows
      const rows = jsonData.slice(1).map((row) => {
        const rowObj: Record<string, string> = {}
        headers.forEach((header, i) => {
          rowObj[header] = String((row as unknown[])[i] || '').trim()
        })
        return rowObj
      }).filter(row => Object.values(row).some(v => v !== '')) // Skip empty rows

      const data: ParsedExcelData = {
        headers,
        rows,
        fileName: file.name,
        sheetName,
      }

      setParsedData(data)
      onDataParsed(data)
    } catch (err) {
      console.error('Error parsing Excel:', err)
      setError(err instanceof Error ? err.message : t('errors.parseError'))
    } finally {
      setIsLoading(false)
    }
  }, [onDataParsed, t])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        setError(t('errors.invalidFormat'))
        return
      }
      parseExcelFile(file)
    }
  }, [parseExcelFile, t])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      parseExcelFile(file)
    }
  }, [parseExcelFile])

  const handleRemoveFile = useCallback(() => {
    setParsedData(null)
    setError(null)
  }, [])

  if (parsedData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium">{parsedData.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {t('rowCount', { count: parsedData.rows.length })} &bull; {t('columnCount', { count: parsedData.headers.length })}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleRemoveFile}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium mb-2">{t('detectedColumns')}</p>
            <div className="flex flex-wrap gap-2">
              {parsedData.headers.map((header, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-sm"
                >
                  {header}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-12 text-center transition-colors',
            isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
            isLoading && 'opacity-50 pointer-events-none'
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">{t('dragDropTitle')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('dragDropSubtitle')}
          </p>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="excel-upload"
          />
          <Button asChild variant="outline" disabled={isLoading}>
            <label htmlFor="excel-upload" className="cursor-pointer">
              {isLoading ? t('parsing') : t('selectFile')}
            </label>
          </Button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
