# AI Agent Foundation (Database)

This document records the initial AI foundation database schema created on February 10, 2026.

## Summary

We added a complete AI foundation in the `public` schema to support:

- Chat sessions and messages
- Tool call audit logs
- Agent tasks and step orchestration
- User preferences for AI behavior
- RLS policies for user isolation and admin override

All tables were created using Supabase MCP migration `ai_agent_foundation`.

## Tables

### `public.ai_sessions`

Stores per-user chat sessions.

Key fields:

- `user_id` (auth.users)
- `company_id` (public.companies, nullable)
- `status` (`active` | `archived`)
- `last_message_at`
- `metadata` (jsonb)

### `public.ai_messages`

Stores all messages in a session, including tool messages.

Key fields:

- `session_id` (ai_sessions)
- `role` (`system` | `user` | `assistant` | `tool`)
- `content`
- `tool_name`, `tool_input`, `tool_output`
- `tokens_in`, `tokens_out`, `latency_ms`

### `public.ai_tool_runs`

Tool execution audit table.

Key fields:

- `session_id` (ai_sessions)
- `message_id` (ai_messages, nullable)
- `tool_name`
- `input`, `output`
- `status` (`pending` | `running` | `succeeded` | `failed` | `canceled`)
- `error`, `started_at`, `completed_at`, `latency_ms`

### `public.ai_tasks`

Long-running or multi-step agent tasks.

Key fields:

- `created_by` (auth.users)
- `session_id` (ai_sessions, nullable)
- `company_id` (public.companies, nullable)
- `status` (`pending` | `in_progress` | `waiting_approval` | `completed` | `failed` | `canceled`)
- `priority` (smallint)
- `metadata` (jsonb)

### `public.ai_task_steps`

Detailed steps per task, with approvals.

Key fields:

- `task_id` (ai_tasks)
- `step_order`
- `status` (`pending` | `in_progress` | `waiting_approval` | `completed` | `failed` | `skipped`)
- `tool_name`, `input`, `output`
- `requires_approval`, `approved_by`, `approved_at`
- `error`

### `public.ai_preferences`

Per-user AI configuration.

Key fields:

- `user_id` (unique)
- `company_id` (nullable)
- `locale`
- `response_style`
- `auto_execute_level` (`suggest_only` | `confirm` | `auto_low_risk`)
- `metadata`

## RLS Policies

All AI tables have RLS enabled. Policies:

- User-scoped access to their own sessions, messages, tool runs, tasks, steps, and preferences.
- Admin override for `SELECT` on all AI tables.

## Indexes

Indexes were added on common lookup paths (user_id, session_id, created_at, status).

## Next Steps

- Add updated_at triggers if we need automatic timestamp maintenance.
- Implement `/api/ai/chat` and minimal tool registry.
- Start with a single tool: `get_survey_progress`.

