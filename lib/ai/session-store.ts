import type { ChatContext } from '@/lib/ai/types'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'

export async function getOrCreateSession(
  supabase: any,
  context: ChatContext,
  sessionId?: string | null
): Promise<string> {
  if (sessionId) {
    const { data } = await supabase
      .from('ai_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', context.userId)
      .single()
    if (data?.id) {
      return data.id
    }
  }

  const { data, error } = await supabase
    .from('ai_sessions')
    .insert({
      user_id: context.userId,
      company_id: context.companyId || null,
      locale: context.locale || null,
      status: 'active',
      last_message_at: new Date().toISOString(),
      metadata: {},
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error('Failed to create AI session.')
  }

  return data.id
}

export async function logMessage({
  supabase,
  sessionId,
  role,
  content,
  toolName,
  toolInput,
  toolOutput,
  tokensIn,
  tokensOut,
  latencyMs,
}: {
  supabase: any
  sessionId: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  toolName?: string | null
  toolInput?: unknown | null
  toolOutput?: unknown | null
  tokensIn?: number | null
  tokensOut?: number | null
  latencyMs?: number | null
}): Promise<string | null> {
  const { data } = await supabase
    .from('ai_messages')
    .insert({
      session_id: sessionId,
      role,
      content: content || null,
      tool_name: toolName || null,
      tool_input: toolInput || null,
      tool_output: toolOutput || null,
      tokens_in: tokensIn || null,
      tokens_out: tokensOut || null,
      latency_ms: latencyMs || null,
    })
    .select('id')
    .single()

  return data?.id || null
}

export async function updateSessionActivity(
  supabase: any,
  sessionId: string
): Promise<void> {
  await supabase
    .from('ai_sessions')
    .update({
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
}

export async function logToolRun({
  supabase,
  sessionId,
  messageId,
  toolName,
  input,
  output,
  status,
  error,
  startedAt,
  completedAt,
  latencyMs,
}: {
  supabase: any
  sessionId: string
  messageId?: string | null
  toolName: string
  input?: unknown | null
  output?: unknown | null
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'
  error?: string | null
  startedAt?: string | null
  completedAt?: string | null
  latencyMs?: number | null
}): Promise<string | null> {
  const { data } = await supabase
    .from('ai_tool_runs')
    .insert({
      session_id: sessionId,
      message_id: messageId || null,
      tool_name: toolName,
      input: input || null,
      output: output || null,
      status,
      error: error || null,
      started_at: startedAt || new Date().toISOString(),
      completed_at: completedAt || null,
      latency_ms: latencyMs || null,
    })
    .select('id')
    .single()

  return data?.id || null
}

export async function createPendingTask({
  supabase,
  sessionId,
  createdBy,
  companyId,
  title,
  goal,
  toolName,
  input,
}: {
  supabase: any
  sessionId: string
  createdBy: string
  companyId?: string | null
  title: string
  goal?: string | null
  toolName: string
  input?: unknown | null
}): Promise<{ taskId: string; stepId: string }> {
  const { data: task, error: taskError } = await supabase
    .from('ai_tasks')
    .insert({
      session_id: sessionId,
      created_by: createdBy,
      company_id: companyId || null,
      title,
      goal: goal || null,
      status: 'waiting_approval',
      metadata: {},
    })
    .select('id')
    .single()

  if (taskError || !task?.id) {
    throw new Error('Failed to create AI task')
  }

  const { data: step, error: stepError } = await supabase
    .from('ai_task_steps')
    .insert({
      task_id: task.id,
      step_order: 1,
      status: 'waiting_approval',
      tool_name: toolName,
      input: input || null,
      requires_approval: true,
    })
    .select('id')
    .single()

  if (stepError || !step?.id) {
    throw new Error('Failed to create AI task step')
  }

  return { taskId: task.id, stepId: step.id }
}

export async function getSessionMessages(
  supabase: any,
  sessionId: string,
  limit: number = 20
): Promise<MessageParam[]> {
  // Fetch the latest N messages by ordering desc, then reverse to chronological order
  const { data: rawData } = await supabase
    .from('ai_messages')
    .select('role, content, tool_name, tool_input, tool_output')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!rawData || rawData.length === 0) return []

  const data = rawData.reverse()

  const messages: MessageParam[] = []

  for (const row of data) {
    if (row.role === 'user' && row.content) {
      messages.push({ role: 'user', content: row.content })
    } else if (row.role === 'assistant' && row.content) {
      messages.push({ role: 'assistant', content: row.content })
    }
    // Tool messages are already embedded in assistant responses via Claude's
    // tool_use/tool_result protocol, so we skip them here to avoid duplication.
    // The conversation history gives Claude enough context to understand
    // what was previously discussed without replaying tool calls.
  }

  return messages
}

export async function updateToolRun({
  supabase,
  toolRunId,
  status,
  output,
  error,
  completedAt,
  latencyMs,
}: {
  supabase: any
  toolRunId: string
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'
  output?: unknown | null
  error?: string | null
  completedAt?: string | null
  latencyMs?: number | null
}): Promise<void> {
  await supabase
    .from('ai_tool_runs')
    .update({
      status,
      output: output || null,
      error: error || null,
      completed_at: completedAt || new Date().toISOString(),
      latency_ms: latencyMs || null,
    })
    .eq('id', toolRunId)
}
