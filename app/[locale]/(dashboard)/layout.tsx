import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import { AuthProvider } from '@/contexts/auth-context'
import { Toaster } from '@/components/ui/sonner'
import { DashboardGuard } from '@/components/dashboard-guard'
import { DashboardContent } from './dashboard-content'
import { LanguageSwitcher } from '@/components/language-switcher'
import { AIChatPanelProvider } from '@/components/ai-chat/ai-chat-panel-context'
import { AIChatPanel } from '@/components/ai-chat/ai-chat-panel'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardGuard>
      <AuthProvider>
        <AIChatPanelProvider>
          <DashboardContent>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-2 sm:px-4">
                  <div className="flex items-center gap-2">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                  </div>
                  <LanguageSwitcher />
                </header>
                <main className="flex-1 overflow-auto">
                  {children}
                </main>
              </SidebarInset>
              <AIChatPanel />
            </SidebarProvider>
          </DashboardContent>
          <Toaster />
        </AIChatPanelProvider>
      </AuthProvider>
    </DashboardGuard>
  )
}
