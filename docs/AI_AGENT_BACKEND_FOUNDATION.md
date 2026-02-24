# AI Agent Backend Foundation (Phase 1)

This document records the first backend foundation for the AI agent layer. Created on February 10, 2026.

## What Was Added

### 1. SSE Chat Endpoint

File: `app/api/ai/chat/route.ts`

- `POST /api/ai/chat`
- Auth + role check (admin, specialist, hr)
- Streams responses as Server-Sent Events (SSE)
- Creates or reuses `ai_sessions`
- Logs messages and tool runs in AI tables

SSE event types:

- `text` — assistant response
- `tool_result` — tool output (structured)
- `error` — error message
- `done` — session id

### 2. Tool Registry + Agent Router

Files:

- `lib/ai/tool-registry.ts`
- `lib/ai/agent.ts`
- `lib/ai/types.ts`

Behavior:

- Detects a basic intent for survey progress.
- Runs `get_survey_progress` tool when intent is detected.
- Falls back to a simple help response if intent is unclear.

### 3. Data Access for Progress Tool

File: `lib/ai/data-access.ts`

Uses existing DB views and tables:

- `surveys`
- `survey_stats`
- `holding_survey_company_stats`

Access control rules:

- HR can only view company surveys from their own company.
- HR on holding surveys sees only their company’s stats.
- Admin/Specialist can see holding survey aggregates.

### 4. Session + Tool Logging

File: `lib/ai/session-store.ts`

Writes to:

- `ai_sessions`
- `ai_messages`
- `ai_tool_runs`

This creates auditable history for chat and tool usage.

## First Tool (Basic Feature)

Tool name: `get_survey_progress`

Input:

- `surveyId` (uuid) or `title` (string)
- `latest` (boolean) to fetch most recent survey

Output:

- Summary: total assigned, total completed, completion %
- Holding survey: breakdown by company

## Second Tool + Action

Tool name: `get_non_respondents`

Input:

- `surveyId` (uuid) or `title` (string) or `latest` (boolean)
- `limit` (int, optional)

Output:

- `count` and preview list of employees who have not completed

Action:

- `send_reminders` requires user confirmation
- Confirmation handled by `POST /api/ai/confirm-action`

## Third Tool

Tool name: `get_invitation_status`

Input:

- `surveyId` (uuid) or `title` (string) or `latest` (boolean)

Output:

- total, sent, delivered, clicked, completed, failed, bounced

## Fourth Tool

Tool name: `get_surveys`

Input:

- `status` (draft | active | closed | all)
- `limit` (optional)

Output:

- list of surveys with status/scope/deadline

## Survey Title Suggestions

If a survey title is not found, the backend now returns a "Did you mean" list
based on partial matches (ILike search). This is handled by
`SurveyNotFoundError` and surfaced by the agent as a suggestion list.

## Out-of-Scope Guard

The agent now rejects non‑survey questions before sending to the LLM.
This keeps the assistant focused on HR survey operations.

## Language Enforcement

The agent now forces responses to match the selected UI language
(English or Mongolian) using explicit LLM instructions and
localized fallback messages.

## LLM Intent Classifier

The agent now uses Gemini to classify messages as:

- `greeting`
- `in_scope`
- `out_of_scope`

If classification fails, it falls back to keyword-based detection.

## Progress Intent (Mongolian)

Progress intent now recognizes Mongolian keywords (e.g., "явц", "гүйцэтгэл", "статус")
and simple transliterations to avoid missing tool routing.

## Notes / Limitations

- Gemini LLM is now integrated for response generation.
- Tool routing still starts with simple intent detection (progress tool).
- Streaming and logging are production-ready.

## Gemini Configuration

Environment variables used:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional, default `gemini-1.5-flash`)

## Next Steps

1. Add front-end AI sidebar UI + chat provider.
2. Add LLM provider integration (Anthropic/OpenAI) with safe tool calling.
3. Add more tools (non-respondents, send reminders, sentiment summary).
