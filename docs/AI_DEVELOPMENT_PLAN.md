# AI Agent Development Plan

## Current State Summary

- **~2,400 lines** of AI code across `lib/ai/`, `app/api/ai/`, `components/ai-chat/`
- **4 read-only tools**: survey progress, non-respondents, invitation status, survey listing
- **1 write action**: send reminders (with confirmation flow)
- **Intent detection**: Regex keyword matching + Gemini fallback classifier
- **LLM**: Google Gemini 2.5 Flash (intent classification + response formatting)
- **Infrastructure**: SSE streaming, session persistence, audit logging, action confirmation

### Critical Problems

| Problem | Impact |
|---------|--------|
| Keyword-based intent router (`agent.ts`) | Breaks on natural language variations. "Who's slacking on Q3?" fails. |
| No conversation memory in LLM calls | User can't say "send reminders to those people" after seeing non-respondents |
| Gemini used for classification only | Not leveraging native tool_use — compensating with 500 lines of regex |
| Only 4 read-only tools | Platform has rich write capabilities the AI can't access |

---

## Phase 1: Replace Keyword Router with Claude Tool Use
**Priority: CRITICAL | Effort: 2-3 days**

Replace the entire `agent.ts` keyword router with Claude's native tool calling.
Claude decides which tool to call, extracts parameters, and generates natural language responses — all in one API call.

### What Changes

| File | Action | Details |
|------|--------|---------|
| `lib/ai/agent.ts` | **REWRITE** | Remove all `detect*Intent()` functions. New `runAgent()` calls Claude with tool definitions and conversation history |
| `lib/ai/claude.ts` | **NEW** | Claude API client (replaces `gemini.ts`) |
| `lib/ai/tools.ts` | **NEW** | Unified tool definitions in Claude tool_use format, mapping to existing data-access functions |
| `lib/ai/prompts.ts` | **UPDATE** | Enhanced system prompt with tool usage instructions and domain knowledge |
| `lib/ai/types.ts` | **UPDATE** | Add Claude-specific types (tool results, message history) |
| `lib/ai/session-store.ts` | **UPDATE** | Add `getSessionMessages()` to load conversation history |
| `app/api/ai/chat/route.ts` | **UPDATE** | Pass conversation history to agent, handle Claude streaming |
| `lib/ai/classifier.ts` | **DELETE** | No longer needed — Claude handles classification natively |
| `lib/ai/gemini.ts` | **DELETE** | Replaced by `claude.ts` |
| `package.json` | **UPDATE** | Add `@anthropic-ai/sdk`, remove `@google/generative-ai` |

### Architecture After Phase 1

```
User message + last 20 messages from session
        │
        ▼
┌─────────────────────────────────────────────┐
│  Claude API (claude-sonnet-4-5)             │
│  - System prompt (domain rules + locale)    │
│  - Conversation history (multi-turn)        │
│  - Tool definitions (4 tools)               │
│                                             │
│  Claude decides:                            │
│  1. Which tool(s) to call                   │
│  2. Extracts parameters from natural lang   │
│  3. Generates response from tool results    │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Tool Execution Layer                       │
│  - get_survey_progress → data-access.ts     │
│  - get_non_respondents → data-access.ts     │
│  - get_invitation_status → data-access.ts   │
│  - get_surveys → data-access.ts             │
│  - send_reminders → confirmation flow       │
└─────────────────────────────────────────────┘
              │
              ▼
        SSE stream to frontend (unchanged)
```

### Files NOT Changed (Preserved)
- `lib/ai/data-access.ts` — All DB queries stay as-is
- `lib/ai/tool-registry.ts` — Kept for internal validation
- `lib/ai/tools/*.ts` — Type definitions and schemas preserved
- `lib/ai/session-store.ts` — Extended, not rewritten
- `components/ai-chat/*` — Frontend unchanged (SSE protocol stays same)
- `app/api/ai/confirm-action/route.ts` — Confirmation flow unchanged

---

## Phase 2: Add Write Tools
**Priority: HIGH | Effort: 3-4 days**

### New Tools

| Tool | Description | Confirmation Required |
|------|-------------|----------------------|
| `send_survey_reminders` | Send reminder emails to non-respondents | YES |
| `activate_survey` | Change survey status from draft to active | YES |
| `close_survey` | Change survey status to closed | YES |
| `generate_report` | Trigger PDF report generation | NO |
| `trigger_sentiment_analysis` | Send survey to AI analysis server | YES |
| `get_sentiment_results` | Read sentiment analysis results | NO |

### Implementation Pattern
```typescript
// Each write tool follows this pattern:
{
  name: "send_survey_reminders",
  description: "Send reminder emails to employees who haven't completed a survey",
  input_schema: { surveyId: string, employeeIds?: string[] },
  // Tool returns a "pending_confirmation" result
  // Frontend shows confirm/cancel dialog
  // On confirm → executes via existing API endpoint
}
```

---

## Phase 3: Multi-Step Agentic Workflows
**Priority: MEDIUM | Effort: 4-5 days**

Enable Claude to chain multiple tool calls in a single conversation turn.

### Key Workflows

1. **Survey lifecycle**: "Create a workplace satisfaction survey with 10 questions, assign to all companies, set deadline 2 weeks from now"
   → `create_survey` → `add_questions` → `assign_companies` → `set_deadline`

2. **Smart reminders**: "Check who hasn't responded to Q3 survey and send them reminders"
   → `get_non_respondents` → `send_survey_reminders` (with confirmation)

3. **Full reporting**: "Generate the CEO report for Q3 survey with sentiment analysis"
   → `get_survey_progress` → `trigger_sentiment_analysis` → `generate_report`

### New Tools for Multi-Step

| Tool | Description |
|------|-------------|
| `create_survey` | Create new survey (title, scope, deadline) |
| `add_survey_questions` | Add questions to a draft survey |
| `assign_survey_to_companies` | Assign holding survey to companies |
| `send_survey_invitations` | Send initial invitation emails |

---

## Phase 4: Analytical Intelligence
**Priority: MEDIUM | Effort: 3-4 days**

### New Capabilities

1. **Cross-survey comparison**
   - Tool: `compare_surveys` — Compare completion rates across surveys
   - "How does Q3 participation compare to Q2?"

2. **Department analytics**
   - Tool: `get_department_stats` — Response rates by org unit
   - "Which department has the lowest response rate?"

3. **Trend detection**
   - Tool: `get_survey_trends` — Historical completion data
   - "Show me the response rate trend over the last 3 surveys"

4. **Sentiment summaries**
   - Tool: `get_sentiment_summary` — Aggregate sentiment across questions
   - "What's the overall sentiment about management?"

---

## Phase 5: Proactive Intelligence
**Priority: LOW | Effort: 2-3 days**

### Features

1. **Auto-insights on dashboard load**: AI notices patterns and surfaces them
   - "3 surveys have < 50% completion with deadlines this week"
   - "Company B consistently has lowest response rates"

2. **Smart scheduling**: AI suggests optimal reminder timing
   - "Based on past patterns, Tuesday 10am gets highest open rates"

3. **Anomaly detection**: Flag unusual patterns
   - "Q3 response rate dropped 20% compared to Q2 for Engineering dept"

---

## Model Strategy

| Use Case | Model | Reasoning |
|----------|-------|-----------|
| Chat agent (real-time) | `claude-sonnet-4-5` | Fast, good tool use, cost-effective (~$0.003/turn) |
| Complex analysis/reports | `claude-opus-4-6` | Deep reasoning for synthesis tasks |
| Bulk classification | `claude-haiku-4-5` | Cheap for processing many responses |

### Cost Estimate
- Average session: ~10 messages, ~2K tokens/message
- Sonnet: ~$0.06/session
- 50 HR users, 5 sessions/day = $15/day = ~$450/month

---

## Environment Variables

```env
# Phase 1 (new)
ANTHROPIC_API_KEY=sk-ant-...

# Phase 1 (remove after migration)
# GEMINI_API_KEY=...        ← can remove
# GEMINI_MODEL=...          ← can remove
```

---

## Implementation Order (Phase 1 Detailed)

### Step 1: Install Anthropic SDK
```bash
npm install @anthropic-ai/sdk
```

### Step 2: Create Claude client (`lib/ai/claude.ts`)
- Initialize Anthropic client
- Helper to convert conversation history to Claude message format
- Streaming support

### Step 3: Define tools in Claude format (`lib/ai/tools.ts`)
- Convert Zod schemas to Claude `input_schema` (JSON Schema)
- Map each tool to its data-access executor
- Include `send_reminders` as a confirmable tool

### Step 4: Add conversation history loading (`lib/ai/session-store.ts`)
- `getSessionMessages()` — load last N messages for a session
- Convert DB rows to Claude message format

### Step 5: Rewrite agent (`lib/ai/agent.ts`)
- New `runAgent()` that:
  1. Loads conversation history
  2. Calls Claude with tools + history
  3. Executes any tool calls
  4. Returns Claude's final response
- Handle tool_use → tool_result loop
- Handle `send_reminders` confirmation flow

### Step 6: Update chat route (`app/api/ai/chat/route.ts`)
- Pass session history to agent
- Stream Claude's response chunks via SSE
- Maintain same SSE event protocol (frontend unchanged)

### Step 7: Update system prompt (`lib/ai/prompts.ts`)
- Richer domain knowledge
- Tool usage guidelines
- Language enforcement for bilingual support

### Step 8: Clean up
- Delete `lib/ai/classifier.ts`
- Delete `lib/ai/gemini.ts`
- Remove `@google/generative-ai` from package.json
- Update types

---

## Testing Checklist (Phase 1)

### Natural Language Understanding
- [ ] "How's the Q3 engagement survey going?" → calls `get_survey_progress`
- [ ] "Who hasn't filled out the latest survey?" → calls `get_non_respondents`
- [ ] "Show me all active surveys" → calls `get_surveys`
- [ ] "What's the email delivery status?" → calls `get_invitation_status`

### Conversational Context
- [ ] Ask about survey progress → then "send reminders to those people" → works
- [ ] Ask about Company A → then "what about Company B?" → correctly switches
- [ ] "The latest one" → resolves from context of previous message

### Edge Cases
- [ ] Greeting: "Hi" → friendly response, no tool call
- [ ] Out of scope: "What's the weather?" → polite refusal
- [ ] Ambiguous: "How's everything?" → asks to clarify which survey
- [ ] Mongolian: "Сүүлийн судалгааны явц яаж байна?" → responds in Mongolian

### Confirmation Flow
- [ ] "Send reminders for Q3 survey" → shows confirmation → confirm → sends
- [ ] "Send reminders for Q3 survey" → shows confirmation → cancel → cancels

### Error Handling
- [ ] Survey not found → suggests similar survey names
- [ ] No API key → clear error message
- [ ] Rate limit → graceful degradation
