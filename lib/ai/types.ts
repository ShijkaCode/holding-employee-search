export type AIUserRole = 'admin' | 'specialist' | 'hr'

export interface ChatRequest {
  message: string
  sessionId?: string | null
  locale?: string | null
}

export interface ChatContext {
  userId: string
  role: AIUserRole
  companyId?: string | null
  locale?: string | null
}

export interface ToolResult<T = unknown> {
  tool: string
  data: T
}

export interface ChatResponse {
  sessionId: string
  message: string
  toolResult?: ToolResult
}
