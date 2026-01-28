'use client'

import { usePathname } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import {
  LayoutDashboard,
  FileText,
  Settings,
  LogOut,
  Building2,
  Users,
  Search,
  ChevronUp,
  ClipboardList,
  UsersRound,
  Network,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import { useTranslations } from 'next-intl'

export function AppSidebar() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()
  const tNav = useTranslations('Navigation')
  const tCommon = useTranslations('Common')

  // Get user role - default to showing minimal UI if no profile
  const userRole = profile?.role || ''

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || '?'

  const mainNavItems = [
    {
      title: tNav('dashboard'),
      url: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'hr', 'specialist'],
    },
    {
      title: tNav('forms'),
      url: '/forms',
      icon: FileText,
      roles: ['admin', 'hr', 'specialist'],
    },
    {
      title: tNav('employees'),
      url: '/employees',
      icon: UsersRound,
      roles: ['admin', 'hr'],
    },
    {
      title: tNav('surveys'),
      url: '/surveys',
      icon: ClipboardList,
      roles: ['employee'],
    },
  ]

  const adminNavItems = [
    {
      title: tNav('companies'),
      url: '/admin/companies',
      icon: Building2,
      roles: ['admin'],
    },
    {
      title: tNav('orgUnits'),
      url: '/admin/org-units',
      icon: Network,
      roles: ['admin', 'hr'],
    },
    {
      title: tNav('users'),
      url: '/admin/users',
      icon: Users,
      roles: ['admin'],
    },
  ]

  // Filter nav items by role
  const filteredMainNav = userRole
    ? mainNavItems.filter((item) => item.roles.includes(userRole))
    : []

  const filteredAdminNav = userRole
    ? adminNavItems.filter((item) => item.roles.includes(userRole))
    : []

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <span className="font-semibold">{tCommon('feedbackHub')}</span>
        </div>
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={tNav('search')}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{tNav('main')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMainNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url || pathname.startsWith(item.url + '/')}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredAdminNav.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>{tNav('admin')}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredAdminNav.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url || pathname.startsWith(item.url + '/')}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col items-start text-left">
                    <span className="text-sm font-medium truncate max-w-[140px]">
                      {profile?.full_name || tCommon('loading')}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {userRole || tCommon('loading')}
                    </span>
                  </div>
                  <ChevronUp className="h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    {tNav('settings')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {tNav('signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
