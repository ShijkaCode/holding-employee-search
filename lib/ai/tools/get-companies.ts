import { z } from 'zod'

export interface CompanyItem {
  id: string
  name: string
  industry: string | null
  employee_count: number
}

export interface CompanyListResult {
  total: number
  companies: CompanyItem[]
}

export const getCompaniesSchema = z.object({})

export type GetCompaniesInput = z.infer<typeof getCompaniesSchema>
