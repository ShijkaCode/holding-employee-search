'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useTranslations } from 'next-intl'
import { Search, Upload, Users, Building2 } from 'lucide-react'
import { Link } from '@/i18n/navigation'

interface Employee {
  id: string
  full_name: string
  email: string | null
  role: string
  employee_id: string | null
  avatar_url: string | null
  org_unit_id: string | null
  department: string | null
  org_unit?: {
    id: string
    name: string
    level_type: string
  } | null
  org_path?: string | null
}

interface OrgUnit {
  id: string
  name: string
  level_type: string
  path_names: string
  level_depth: number
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<string>('all')

  const { profile } = useAuth()
  const t = useTranslations('Employees')

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) {
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        // Determine which company to query
        // Admin can see all companies, others see only their company
        let companyFilter = profile.company_id

        // If admin has no company_id, try to get first company or show all
        if (!companyFilter && profile.role === 'admin') {
          const { data: firstCompany } = await supabase
            .from('companies')
            .select('id')
            .limit(1)
            .single()

          if (firstCompany) {
            companyFilter = firstCompany.id
          }
        }

        if (!companyFilter) {
          console.warn('No company_id found for user')
          setLoading(false)
          return
        }

        // Fetch employees with their org units
        const { data: employeesData, error: employeesError } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            email,
            role,
            employee_id,
            avatar_url,
            org_unit_id,
            department,
            org_unit:org_units(id, name, level_type)
          `)
          .eq('company_id', companyFilter)
          .order('full_name')

        if (employeesError) {
          console.error('Error fetching employees:', employeesError)
          setLoading(false)
          return
        }

        // Fetch org hierarchy for paths
        const { data: hierarchyData } = await (supabase as any)
          .from('org_hierarchy')
          .select('id, name, level_type, path_names, level_depth')
          .eq('company_id', companyFilter)
          .order('path_names')

        // Create a map of org_unit_id to path_names and filter valid units
        const pathMap = new Map<string, string>()
        const validUnits: OrgUnit[] = []

        hierarchyData?.forEach((h: { id: string | null; name: string | null; level_type: string | null; path_names: string | null; level_depth: number | null }) => {
          if (h.id && h.name && h.level_type && h.path_names !== null && h.level_depth !== null) {
            pathMap.set(h.id, h.path_names || h.name)
            validUnits.push({
              id: h.id,
              name: h.name,
              level_type: h.level_type,
              path_names: h.path_names,
              level_depth: h.level_depth,
            })
          }
        })

        // Format employees with org paths
        const formattedEmployees = (employeesData || []).map((emp) => ({
          ...emp,
          org_unit: Array.isArray(emp.org_unit) ? emp.org_unit[0] : emp.org_unit,
          org_path: emp.org_unit_id ? pathMap.get(emp.org_unit_id) : null,
        }))

        setEmployees(formattedEmployees)
        setOrgUnits(validUnits)
      } catch (error) {
        console.error('Error fetching employees data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [profile, supabase])

  // Filter employees based on search and org unit selection
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch =
        !searchQuery ||
        emp.full_name.toLowerCase().includes(searchLower) ||
        emp.email?.toLowerCase().includes(searchLower) ||
        emp.employee_id?.toLowerCase().includes(searchLower)

      // Org unit filter
      const matchesOrgUnit =
        selectedOrgUnit === 'all' ||
        selectedOrgUnit === 'unassigned'
          ? selectedOrgUnit === 'all' || !emp.org_unit_id
          : emp.org_unit_id === selectedOrgUnit

      return matchesSearch && matchesOrgUnit
    })
  }, [employees, searchQuery, selectedOrgUnit])

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive'
      case 'hr':
        return 'default'
      case 'specialist':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (loading) {
    return (
      <div className="page-container">
        <Skeleton className="h-8 w-36 sm:w-48" />
        <Skeleton className="h-10 sm:h-12 w-full" />
        <Skeleton className="h-64 sm:h-96" />
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground text-sm sm:text-base">{t('subtitle')}</p>
        </div>
        <Button asChild size="sm" className="w-fit">
          <Link href="/employees/import">
            <Upload className="mr-2 h-4 w-4" />
            {t('importEmployees')}
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('title')}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('totalEmployees', { count: employees.length })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('table.orgUnit')}
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orgUnits.length}</div>
            <p className="text-xs text-muted-foreground">
              {orgUnits.length} units
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Unassigned
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {employees.filter((e) => !e.org_unit_id).length}
            </div>
            <p className="text-xs text-muted-foreground">
              without org unit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription>
                {t('totalEmployees', { count: filteredEmployees.length })}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  className="pl-8 w-full sm:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {/* Org Unit Filter */}
              <Select value={selectedOrgUnit} onValueChange={setSelectedOrgUnit}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder={t('filterByUnit')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allUnits')}</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {orgUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.path_names}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.employee')}</TableHead>
                <TableHead>{t('table.employeeId')}</TableHead>
                <TableHead>{t('table.orgUnit')}</TableHead>
                <TableHead>{t('table.role')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={employee.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(employee.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{employee.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {employee.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {employee.employee_id || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {employee.org_path ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{employee.org_path}</span>
                      </div>
                    ) : employee.department ? (
                      <span className="text-sm text-muted-foreground">
                        {employee.department}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(employee.role)}>
                      {t(`roles.${employee.role}` as 'roles.admin' | 'roles.hr' | 'roles.specialist' | 'roles.employee')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredEmployees.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">{t('noEmployees')}</p>
                    <p className="text-sm">{t('noEmployeesDesc')}</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
