# AI Chat Integration - Technical Plan

## Executive Summary

Build a collapsible sidebar chat interface where HR specialists and admins interact with Claude AI to manage surveys. The AI can query data, explain results, and take actions (with confirmation).

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND                                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    AI Chat Sidebar (Right)                          │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │  Message List (streaming)                                     │  │ │
│  │  │  - User messages                                              │  │ │
│  │  │  - AI responses (markdown rendered)                           │  │ │
│  │  │  - Action confirmations (buttons)                             │  │ │
│  │  │  - Loading states ("Checking database...")                    │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │  Input Area                                                   │  │ │
│  │  │  - Textarea (auto-resize)                                     │  │ │
│  │  │  - Send button                                                │  │ │
│  │  │  - Language indicator (EN/MN)                                 │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Next.js API)                            │
│                                                                          │
│  POST /api/ai/chat                                                       │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      AI Chat Handler                                │ │
│  │                                                                      │ │
│  │  1. Validate user (HR/Admin only)                                   │ │
│  │  2. Detect language (EN/MN)                                         │ │
│  │  3. Route to model (Haiku vs Opus)                                  │ │
│  │  4. Build context (user info, company scope)                        │ │
│  │  5. Call Claude API with tools                                      │ │
│  │  6. Stream response back                                            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                    ┌───────────────┼───────────────┐                    │
│                    ▼               ▼               ▼                    │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐        │
│  │  TOOL: Query DB  │ │ TOOL: Send Email │ │ TOOL: Sentiment  │        │
│  │                  │ │                  │ │                  │        │
│  │ - getSurveys     │ │ - sendReminders  │ │ - getSentiment   │        │
│  │ - getProgress    │ │ - (needs confirm)│ │ - explainResults │        │
│  │ - getNonResp     │ │                  │ │                  │        │
│  │ - getEmployees   │ │                  │ │                  │        │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘        │
│                                    │                                     │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   Supabase DB   │  │   Email Service │  │  Sentiment AI   │         │
│  │   (PostgreSQL)  │  │   (Resend/SMTP) │  │    Server       │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Choices

| Component | Technology | Reason |
|-----------|------------|--------|
| **AI SDK** | `@anthropic-ai/sdk` | Official SDK, streaming support, tool use |
| **Streaming** | Server-Sent Events (SSE) | Native browser support, simple implementation |
| **Session Storage** | In-memory (per request) | Session-only memory requirement |
| **Model Routing** | Custom classifier | Route simple→Haiku, complex→Opus |
| **Language Detection** | Simple heuristic + user locale | Detect Cyrillic = Mongolian |
| **Markdown Rendering** | `react-markdown` + `remark-gfm` | Tables, code blocks, links |
| **UI Components** | Shadcn/ui Sheet + existing components | Consistent with current design |

---

## 3. Database Changes

### 3.1 New Table: `ai_chat_logs` (Optional - for analytics)

```sql
CREATE TABLE ai_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,

  -- Message data
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT,
  tool_name TEXT,
  tool_input JSONB,
  tool_output JSONB,

  -- Metadata
  model TEXT, -- 'haiku' or 'opus'
  language TEXT CHECK (language IN ('en', 'mn')),
  tokens_input INT,
  tokens_output INT,
  latency_ms INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user queries
CREATE INDEX idx_chat_logs_user ON ai_chat_logs(user_id, created_at DESC);

-- RLS: Users can only see their own logs
ALTER TABLE ai_chat_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own logs" ON ai_chat_logs
  FOR SELECT USING (auth.uid() = user_id);
```

### 3.2 New View: `survey_progress_summary` (Optimized for AI queries)

```sql
CREATE OR REPLACE VIEW survey_progress_summary AS
SELECT
  s.id AS survey_id,
  s.title,
  s.status,
  s.deadline,
  s.scope,
  s.company_id,
  c.name AS company_name,

  -- Counts
  COUNT(DISTINCT sa.employee_id) AS total_assigned,
  COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.employee_id END) AS completed,
  COUNT(DISTINCT CASE WHEN sr.status = 'in_progress' THEN sr.employee_id END) AS in_progress,
  COUNT(DISTINCT CASE WHEN sr.status IS NULL OR sr.status = 'pending' THEN sa.employee_id END) AS not_started,

  -- Percentage
  ROUND(
    COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.employee_id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT sa.employee_id), 0) * 100,
    1
  ) AS completion_rate

FROM surveys s
LEFT JOIN companies c ON s.company_id = c.id
LEFT JOIN survey_assignments sa ON s.id = sa.survey_id
LEFT JOIN survey_responses sr ON s.id = sr.survey_id AND sa.employee_id = sr.employee_id
GROUP BY s.id, s.title, s.status, s.deadline, s.scope, s.company_id, c.name;
```

---

## 4. AI Tools Design (Claude Tool Use)

### 4.1 Tool Definitions

```typescript
// lib/ai/tools.ts

export const AI_TOOLS = [
  // ============================================
  // TOOL 1: Get Survey List
  // ============================================
  {
    name: "get_surveys",
    description: "Get list of surveys. Can filter by status, company, or date range.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "active", "closed", "all"],
          description: "Filter by survey status"
        },
        company_id: {
          type: "string",
          description: "Filter by specific company UUID"
        },
        search: {
          type: "string",
          description: "Search in survey title"
        },
        limit: {
          type: "number",
          description: "Max results (default 10)"
        }
      }
    }
  },

  // ============================================
  // TOOL 2: Get Survey Progress
  // ============================================
  {
    name: "get_survey_progress",
    description: "Get detailed progress for a specific survey including completion rates by company/department.",
    input_schema: {
      type: "object",
      properties: {
        survey_id: {
          type: "string",
          description: "Survey UUID"
        },
        group_by: {
          type: "string",
          enum: ["company", "org_unit", "none"],
          description: "How to group the results"
        }
      },
      required: ["survey_id"]
    }
  },

  // ============================================
  // TOOL 3: Get Non-Respondents
  // ============================================
  {
    name: "get_non_respondents",
    description: "Get list of employees who haven't completed a survey.",
    input_schema: {
      type: "object",
      properties: {
        survey_id: {
          type: "string",
          description: "Survey UUID"
        },
        company_id: {
          type: "string",
          description: "Filter by company (optional)"
        },
        org_unit_id: {
          type: "string",
          description: "Filter by org unit (optional)"
        },
        include_in_progress: {
          type: "boolean",
          description: "Include employees who started but didn't finish"
        }
      },
      required: ["survey_id"]
    }
  },

  // ============================================
  // TOOL 4: Get Sentiment Analysis
  // ============================================
  {
    name: "get_sentiment_analysis",
    description: "Get sentiment analysis results for a survey. Returns overall sentiment and per-question breakdown.",
    input_schema: {
      type: "object",
      properties: {
        survey_id: {
          type: "string",
          description: "Survey UUID"
        },
        question_code: {
          type: "string",
          description: "Specific question code to analyze (optional)"
        }
      },
      required: ["survey_id"]
    }
  },

  // ============================================
  // TOOL 5: Send Reminders (REQUIRES CONFIRMATION)
  // ============================================
  {
    name: "prepare_reminders",
    description: "Prepare reminder emails for non-respondents. Returns preview of who will receive emails. User must confirm before sending.",
    input_schema: {
      type: "object",
      properties: {
        survey_id: {
          type: "string",
          description: "Survey UUID"
        },
        employee_ids: {
          type: "array",
          items: { type: "string" },
          description: "Specific employee IDs to remind (optional, defaults to all non-respondents)"
        }
      },
      required: ["survey_id"]
    }
  },

  // ============================================
  // TOOL 6: Execute Confirmed Action
  // ============================================
  {
    name: "execute_action",
    description: "Execute a previously prepared action after user confirmation.",
    input_schema: {
      type: "object",
      properties: {
        action_id: {
          type: "string",
          description: "The action ID returned from prepare_* tools"
        },
        confirmed: {
          type: "boolean",
          description: "Must be true to execute"
        }
      },
      required: ["action_id", "confirmed"]
    }
  },

  // ============================================
  // TOOL 7: Get Companies
  // ============================================
  {
    name: "get_companies",
    description: "Get list of companies in the holding.",
    input_schema: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Search by company name"
        }
      }
    }
  },

  // ============================================
  // TOOL 8: Get Survey Questions
  // ============================================
  {
    name: "get_survey_questions",
    description: "Get questions for a specific survey.",
    input_schema: {
      type: "object",
      properties: {
        survey_id: {
          type: "string",
          description: "Survey UUID"
        },
        section_name: {
          type: "string",
          description: "Filter by section (optional)"
        }
      },
      required: ["survey_id"]
    }
  }
];
```

### 4.2 Tool Executors

```typescript
// lib/ai/tool-executors.ts

import { createClient } from '@/lib/supabase/server';

type ToolContext = {
  userId: string;
  userRole: string;
  companyId: string | null; // null for holding-level users
  language: 'en' | 'mn';
};

export async function executeGetSurveys(
  params: { status?: string; company_id?: string; search?: string; limit?: number },
  ctx: ToolContext
) {
  const supabase = await createClient();

  let query = supabase
    .from('survey_progress_summary')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(params.limit || 10);

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }

  if (params.company_id) {
    query = query.eq('company_id', params.company_id);
  }

  if (params.search) {
    query = query.ilike('title', `%${params.search}%`);
  }

  // Company-scoped users can only see their company's surveys
  if (ctx.companyId) {
    query = query.or(`company_id.eq.${ctx.companyId},scope.eq.holding`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function executeGetNonRespondents(
  params: { survey_id: string; company_id?: string; org_unit_id?: string; include_in_progress?: boolean },
  ctx: ToolContext
) {
  const supabase = await createClient();

  // Get assigned employees without completed responses
  let query = supabase
    .from('survey_assignments')
    .select(`
      employee_id,
      profiles!inner(
        id,
        full_name,
        email,
        company_id,
        org_unit_id,
        companies(name),
        org_units(name)
      ),
      survey_responses(status)
    `)
    .eq('survey_id', params.survey_id);

  const { data, error } = await query;
  if (error) throw error;

  // Filter non-respondents
  const nonRespondents = data?.filter(a => {
    const response = a.survey_responses?.[0];
    if (!response) return true; // No response at all
    if (params.include_in_progress && response.status === 'in_progress') return true;
    return response.status !== 'completed';
  });

  return {
    count: nonRespondents?.length || 0,
    employees: nonRespondents?.slice(0, 50).map(a => ({
      id: a.profiles.id,
      name: a.profiles.full_name,
      email: a.profiles.email,
      company: a.profiles.companies?.name,
      department: a.profiles.org_units?.name,
      status: a.survey_responses?.[0]?.status || 'not_started'
    }))
  };
}

// ... more executors for each tool
```

---

## 5. Model Routing (Haiku vs Opus)

### 5.1 Query Classifier

```typescript
// lib/ai/model-router.ts

type ModelChoice = 'haiku' | 'opus';

interface ClassificationResult {
  model: ModelChoice;
  reason: string;
}

// Keywords/patterns that indicate complexity
const OPUS_INDICATORS = [
  // Analytical requests
  /explain|analyze|why|compare|insight|trend|pattern/i,
  /sentiment|mood|feeling|opinion/i,
  /recommend|suggest|advice|should/i,

  // Complex queries
  /across.*(companies|departments|teams)/i,
  /correlation|relationship|impact/i,

  // Creative/generative
  /write|draft|compose|create.*survey/i,
  /summarize|summary|report/i,

  // Multi-step reasoning
  /and then|after that|based on/i,
];

// Keywords that indicate simple queries
const HAIKU_INDICATORS = [
  // Simple lookups
  /^(how many|what is|who|list|show|get)/i,
  /^(check|status|progress)/i,

  // Direct actions
  /^send reminder/i,
  /^remind/i,

  // Simple questions
  /completion rate|response rate/i,
  /deadline|due date/i,
];

export function classifyQuery(userMessage: string): ClassificationResult {
  const message = userMessage.trim().toLowerCase();

  // Check for Opus indicators first (complexity trumps simplicity)
  for (const pattern of OPUS_INDICATORS) {
    if (pattern.test(message)) {
      return {
        model: 'opus',
        reason: `Complex query detected: ${pattern.toString()}`
      };
    }
  }

  // Check for Haiku indicators
  for (const pattern of HAIKU_INDICATORS) {
    if (pattern.test(message)) {
      return {
        model: 'haiku',
        reason: `Simple query detected: ${pattern.toString()}`
      };
    }
  }

  // Default based on message length
  // Longer messages often need more nuanced understanding
  if (message.length > 200) {
    return { model: 'opus', reason: 'Long message requires deeper understanding' };
  }

  // Default to Haiku for cost efficiency
  return { model: 'haiku', reason: 'Default to cost-efficient model' };
}

export function getModelId(choice: ModelChoice): string {
  return choice === 'opus'
    ? 'claude-opus-4-5-20251101'
    : 'claude-haiku-3-5-20241022';
}
```

### 5.2 Mongolian Language Patterns (Added to classifier)

```typescript
// Additional patterns for Mongolian
const OPUS_INDICATORS_MN = [
  /тайлбарла|шинжил|яагаад|харьцуул/i,  // explain, analyze, why, compare
  /санал болго|зөвлө/i,                   // recommend, suggest
  /дүгнэлт|тойм/i,                        // summary, overview
];

const HAIKU_INDICATORS_MN = [
  /хэд|хэн|жагсаа|харуул/i,               // how many, who, list, show
  /явц|статус|хугацаа/i,                  // progress, status, deadline
  /сануул/i,                               // remind
];
```

---

## 6. Session Management

### 6.1 Session Context Structure

```typescript
// lib/ai/session.ts

export interface ChatSession {
  id: string;                    // UUID for this session
  userId: string;                // Current user
  userRole: 'admin' | 'specialist' | 'hr';
  companyId: string | null;      // null = holding-level access
  language: 'en' | 'mn';         // Detected/selected language

  // Conversation history (in-memory only)
  messages: Message[];

  // Pending actions awaiting confirmation
  pendingActions: PendingAction[];

  // Context from recent queries (helps AI reference previous data)
  recentContext: {
    lastSurveyId?: string;
    lastSurveyTitle?: string;
    lastCompanyId?: string;
    lastCompanyName?: string;
  };

  // Timestamps
  createdAt: Date;
  lastActivityAt: Date;
}

export interface Message {
  role: 'user' | 'assistant' | 'tool_use' | 'tool_result';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  timestamp: Date;
}

export interface PendingAction {
  id: string;                    // Action UUID
  type: 'send_reminders' | 'generate_report';
  params: Record<string, unknown>;
  preview: {
    description: string;         // Human-readable description
    affectedCount: number;       // e.g., "12 employees will receive emails"
    details: unknown;            // Full data for display
  };
  createdAt: Date;
  expiresAt: Date;               // Actions expire after 5 minutes
}
```

### 6.2 Session Store (In-Memory)

```typescript
// lib/ai/session-store.ts

import { ChatSession } from './session';

// Simple in-memory store (per-process)
// For production with multiple servers, use Redis
const sessions = new Map<string, ChatSession>();

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    // Remove sessions inactive for 30 minutes
    if (now - session.lastActivityAt.getTime() > 30 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

export function createSession(params: {
  userId: string;
  userRole: string;
  companyId: string | null;
  language: 'en' | 'mn';
}): ChatSession {
  const session: ChatSession = {
    id: crypto.randomUUID(),
    ...params,
    messages: [],
    pendingActions: [],
    recentContext: {},
    createdAt: new Date(),
    lastActivityAt: new Date(),
  };

  sessions.set(session.id, session);
  return session;
}

export function getSession(sessionId: string): ChatSession | null {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivityAt = new Date();
  }
  return session || null;
}

export function updateSession(sessionId: string, updates: Partial<ChatSession>): void {
  const session = sessions.get(sessionId);
  if (session) {
    Object.assign(session, updates, { lastActivityAt: new Date() });
  }
}
```

---

## 7. API Endpoint Design

### 7.1 Main Chat Endpoint

```typescript
// app/api/ai/chat/route.ts

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { AI_TOOLS } from '@/lib/ai/tools';
import { executeToolCall } from '@/lib/ai/tool-executors';
import { classifyQuery, getModelId } from '@/lib/ai/model-router';
import { getSession, createSession, updateSession } from '@/lib/ai/session-store';
import { detectLanguage } from '@/lib/ai/language';
import { buildSystemPrompt } from '@/lib/ai/prompts';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: Request) {
  // 1. Authenticate user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Verify role (HR/Admin only)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id, full_name')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'specialist', 'hr'].includes(profile.role)) {
    return Response.json({ error: 'AI chat is only available for HR and Admin users' }, { status: 403 });
  }

  // 3. Parse request
  const { message, sessionId, locale } = await request.json();

  // 4. Get or create session
  let session = sessionId ? getSession(sessionId) : null;

  if (!session) {
    const detectedLanguage = detectLanguage(message, locale);
    session = createSession({
      userId: user.id,
      userRole: profile.role,
      companyId: profile.company_id,
      language: detectedLanguage,
    });
  }

  // 5. Add user message to history
  session.messages.push({
    role: 'user',
    content: message,
    timestamp: new Date(),
  });

  // 6. Classify query and select model
  const { model, reason } = classifyQuery(message);
  const modelId = getModelId(model);

  // 7. Build system prompt
  const systemPrompt = buildSystemPrompt({
    language: session.language,
    userName: profile.full_name,
    userRole: profile.role,
    recentContext: session.recentContext,
  });

  // 8. Prepare messages for Claude
  const claudeMessages = session.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }));

  // 9. Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Initial response with streaming
        const response = await anthropic.messages.create({
          model: modelId,
          max_tokens: 4096,
          system: systemPrompt,
          tools: AI_TOOLS,
          messages: claudeMessages,
          stream: true,
        });

        let fullResponse = '';
        let toolUse = null;

        for await (const event of response) {
          if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              fullResponse += event.delta.text;
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'text', content: event.delta.text })}\n\n`
              ));
            }
          } else if (event.type === 'content_block_start') {
            if (event.content_block.type === 'tool_use') {
              toolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                input: {},
              };
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'tool_start', tool: event.content_block.name })}\n\n`
              ));
            }
          } else if (event.type === 'message_stop') {
            // Handle tool execution if needed
            if (toolUse) {
              const toolResult = await executeToolCall(
                toolUse.name,
                toolUse.input,
                {
                  userId: user.id,
                  userRole: profile.role,
                  companyId: profile.company_id,
                  language: session.language,
                }
              );

              // Send tool result to client for display
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'tool_result', tool: toolUse.name, data: toolResult })}\n\n`
              ));

              // Continue conversation with tool result
              // (Recursive call or continuation logic)
            }
          }
        }

        // Save assistant response to session
        session.messages.push({
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date(),
        });
        updateSession(session.id, session);

        // Send session ID and completion
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'done', sessionId: session.id, model })}\n\n`
        ));
        controller.close();

      } catch (error) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`
        ));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 7.2 Action Confirmation Endpoint

```typescript
// app/api/ai/confirm-action/route.ts

export async function POST(request: Request) {
  const { sessionId, actionId, confirmed } = await request.json();

  const session = getSession(sessionId);
  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  const action = session.pendingActions.find(a => a.id === actionId);
  if (!action) {
    return Response.json({ error: 'Action not found or expired' }, { status: 404 });
  }

  if (!confirmed) {
    // Remove action from pending
    session.pendingActions = session.pendingActions.filter(a => a.id !== actionId);
    return Response.json({ success: true, message: 'Action cancelled' });
  }

  // Execute the action
  try {
    let result;

    if (action.type === 'send_reminders') {
      result = await executeSendReminders(action.params);
    } else if (action.type === 'generate_report') {
      result = await executeGenerateReport(action.params);
    }

    // Remove from pending
    session.pendingActions = session.pendingActions.filter(a => a.id !== actionId);

    return Response.json({ success: true, result });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 8. System Prompts

### 8.1 English System Prompt

```typescript
// lib/ai/prompts.ts

export function buildSystemPrompt(params: {
  language: 'en' | 'mn';
  userName: string;
  userRole: string;
  recentContext: Record<string, string>;
}): string {

  const basePrompt = params.language === 'mn'
    ? MONGOLIAN_SYSTEM_PROMPT
    : ENGLISH_SYSTEM_PROMPT;

  return `${basePrompt}

## Current Context
- User: ${params.userName} (${params.userRole})
- Language: ${params.language === 'mn' ? 'Mongolian' : 'English'}
${params.recentContext.lastSurveyTitle ? `- Recently discussed survey: "${params.recentContext.lastSurveyTitle}"` : ''}
${params.recentContext.lastCompanyName ? `- Recently discussed company: "${params.recentContext.lastCompanyName}"` : ''}

Remember: Always respond in ${params.language === 'mn' ? 'Mongolian' : 'English'} to match the user's language.`;
}

const ENGLISH_SYSTEM_PROMPT = `You are an AI assistant for an HR Survey platform. You help HR specialists and administrators manage employee feedback surveys.

## Your Capabilities
1. **Survey Progress**: Check completion rates, status, and deadlines
2. **Non-Respondents**: Find employees who haven't completed surveys
3. **Sentiment Analysis**: Explain survey results and employee sentiment
4. **Send Reminders**: Prepare reminder emails (always ask for confirmation first)

## Important Rules
1. **Always confirm before taking actions** like sending emails. Show a preview and ask "Should I proceed?"
2. **Be concise** but helpful. Use bullet points for lists.
3. **Use data** from tools to give accurate answers. Don't make up numbers.
4. **Respect privacy**: Don't share individual employee responses, only aggregate data.
5. **Reference context**: If the user mentions "the survey" or "it", refer to the most recently discussed survey.

## Response Format
- Use markdown for formatting (tables, bold, lists)
- For numbers/stats, use tables when showing multiple items
- Keep explanations brief unless the user asks for details

## When You Don't Have Information
- If a tool returns empty results, say so clearly
- If you need more information to help, ask specific questions`;

const MONGOLIAN_SYSTEM_PROMPT = `Та HR Судалгааны платформын AI туслах юм. Та HR мэргэжилтнүүд болон админуудад ажилтнуудын санал хүсэлтийн судалгааг удирдахад тусалдаг.

## Таны чадварууд
1. **Судалгааны явц**: Гүйцэтгэлийн хувь, статус, эцсийн хугацааг шалгах
2. **Хариу өгөөгүйчүүд**: Судалгаа бөглөөгүй ажилтнуудыг олох
3. **Сэтгэл хөдлөлийн шинжилгээ**: Судалгааны үр дүн, ажилтнуудын сэтгэл хөдлөлийг тайлбарлах
4. **Сануулга илгээх**: Сануулах имэйл бэлтгэх (үргэлж эхлээд баталгаажуулалт асуух)

## Чухал дүрмүүд
1. **Имэйл илгээх гэх мэт үйлдэл хийхээс өмнө үргэлж баталгаажуулах**. Урьдчилж харуулаад "Үргэлжлүүлэх үү?" гэж асуух.
2. **Товч** гэхдээ тустай байх. Жагсаалтад bullet point ашиглах.
3. **Хэрэгслүүдээс авсан мэдээлэл** ашиглан үнэн зөв хариулт өгөх. Тоо бүү зохио.
4. **Нууцлалыг хүндэтгэх**: Хувь хүний хариултыг бүү хуваалц, зөвхөн нэгтгэсэн мэдээлэл.
5. **Контекстийг санах**: Хэрэглэгч "судалгаа" эсвэл "энэ" гэж дурдвал хамгийн сүүлд ярилцсан судалгааг харгалзах.

## Хариултын формат
- Markdown ашиглах (хүснэгт, bold, жагсаалт)
- Олон зүйлийн тоо/статистик харуулахдаа хүснэгт ашиглах
- Хэрэглэгч дэлгэрэнгүй асуухгүй бол товч тайлбарлах`;
```

---

## 9. Frontend Components

### 9.1 Component Tree

```
components/ai-chat/
├── ai-chat-sidebar.tsx       # Main container (Sheet component)
├── ai-chat-header.tsx        # Title, close button, language indicator
├── ai-chat-messages.tsx      # Message list with virtualization
├── ai-chat-message.tsx       # Single message (user/assistant)
├── ai-chat-input.tsx         # Input textarea with send button
├── ai-chat-tool-result.tsx   # Display tool results (tables, lists)
├── ai-chat-confirmation.tsx  # Action confirmation dialog
├── ai-chat-loading.tsx       # "AI is checking..." indicator
└── ai-chat-provider.tsx      # React context for chat state
```

### 9.2 Main Sidebar Component

```tsx
// components/ai-chat/ai-chat-sidebar.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MessageSquare, X, Minimize2 } from 'lucide-react';
import { useLocale } from 'next-intl';
import { AIChatMessages } from './ai-chat-messages';
import { AIChatInput } from './ai-chat-input';
import { useAIChat } from './ai-chat-provider';

export function AIChatSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const locale = useLocale();
  const { messages, isLoading, sendMessage, sessionId } = useAIChat();

  return (
    <>
      {/* Floating button when closed */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          size="icon"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      )}

      {/* Chat sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-[400px] sm:w-[540px] p-0 flex flex-col"
        >
          <SheetHeader className="px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {locale === 'mn' ? 'AI Туслах' : 'AI Assistant'}
              </SheetTitle>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                  {locale.toUpperCase()}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* Messages area */}
          <div className="flex-1 overflow-hidden">
            <AIChatMessages messages={messages} isLoading={isLoading} />
          </div>

          {/* Input area */}
          <div className="border-t p-4">
            <AIChatInput
              onSend={sendMessage}
              disabled={isLoading}
              placeholder={locale === 'mn'
                ? 'Асуултаа бичнэ үү...'
                : 'Type your question...'}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

### 9.3 Chat Provider (State Management)

```tsx
// components/ai-chat/ai-chat-provider.tsx

'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useLocale } from 'next-intl';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolResults?: ToolResult[];
  timestamp: Date;
  isStreaming?: boolean;
}

interface ToolResult {
  tool: string;
  data: unknown;
}

interface PendingAction {
  id: string;
  type: string;
  description: string;
  affectedCount: number;
}

interface AIChatContextType {
  messages: Message[];
  isLoading: boolean;
  sessionId: string | null;
  pendingAction: PendingAction | null;
  sendMessage: (content: string) => Promise<void>;
  confirmAction: (confirmed: boolean) => Promise<void>;
  clearChat: () => void;
}

const AIChatContext = createContext<AIChatContextType | null>(null);

export function AIChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const locale = useLocale();
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Create placeholder for assistant message
    const assistantMessageId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }]);

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, sessionId, locale }),
        signal: abortControllerRef.current.signal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'text') {
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, content: m.content + data.content }
                  : m
              ));
            } else if (data.type === 'tool_result') {
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, toolResults: [...(m.toolResults || []), data] }
                  : m
              ));
            } else if (data.type === 'action_pending') {
              setPendingAction(data.action);
            } else if (data.type === 'done') {
              setSessionId(data.sessionId);
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, isStreaming: false }
                  : m
              ));
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === assistantMessageId
            ? { ...m, content: 'Sorry, an error occurred. Please try again.', isStreaming: false }
            : m
        ));
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, locale]);

  const confirmAction = useCallback(async (confirmed: boolean) => {
    if (!pendingAction || !sessionId) return;

    try {
      const response = await fetch('/api/ai/confirm-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          actionId: pendingAction.id,
          confirmed,
        }),
      });

      const result = await response.json();

      // Add result message
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: confirmed
          ? `✅ ${result.message || 'Action completed successfully.'}`
          : `❌ Action cancelled.`,
        timestamp: new Date(),
      }]);

    } finally {
      setPendingAction(null);
    }
  }, [pendingAction, sessionId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setPendingAction(null);
  }, []);

  return (
    <AIChatContext.Provider value={{
      messages,
      isLoading,
      sessionId,
      pendingAction,
      sendMessage,
      confirmAction,
      clearChat,
    }}>
      {children}
    </AIChatContext.Provider>
  );
}

export function useAIChat() {
  const context = useContext(AIChatContext);
  if (!context) {
    throw new Error('useAIChat must be used within AIChatProvider');
  }
  return context;
}
```

---

## 10. Language Detection & i18n

### 10.1 Language Detection

```typescript
// lib/ai/language.ts

// Mongolian Cyrillic character range
const MONGOLIAN_PATTERN = /[\u0400-\u04FF]/;

export function detectLanguage(text: string, fallbackLocale: string = 'en'): 'en' | 'mn' {
  // Check for Cyrillic characters (Mongolian)
  if (MONGOLIAN_PATTERN.test(text)) {
    return 'mn';
  }

  // Use locale as fallback
  if (fallbackLocale === 'mn') {
    return 'mn';
  }

  return 'en';
}

// Ensure AI responds in the same language
export function getResponseLanguageInstruction(language: 'en' | 'mn'): string {
  if (language === 'mn') {
    return 'IMPORTANT: Respond in Mongolian (Монгол хэл дээр хариулна уу).';
  }
  return 'Respond in English.';
}
```

---

## 11. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up `@anthropic-ai/sdk`
- [ ] Create basic `/api/ai/chat` endpoint
- [ ] Implement session management (in-memory)
- [ ] Build `AIChatSidebar` component
- [ ] Add streaming support
- [ ] Language detection

### Phase 2: Core Tools (Week 2)
- [ ] Implement `get_surveys` tool
- [ ] Implement `get_survey_progress` tool
- [ ] Implement `get_non_respondents` tool
- [ ] Create `survey_progress_summary` view
- [ ] Add tool result display components

### Phase 3: Sentiment Integration (Week 3)
- [ ] Implement `get_sentiment_analysis` tool
- [ ] Connect to external sentiment server
- [ ] Build sentiment result visualization
- [ ] Add explanation generation

### Phase 4: Actions (Week 4)
- [ ] Implement `prepare_reminders` tool
- [ ] Build action confirmation flow
- [ ] Implement `execute_action` endpoint
- [ ] Add success/failure feedback

### Phase 5: Polish (Week 5)
- [ ] Model routing (Haiku/Opus)
- [ ] Error handling improvements
- [ ] Loading states and animations
- [ ] Mongolian translations
- [ ] Testing and bug fixes

---

## 12. File Structure

```
lib/
├── ai/
│   ├── anthropic.ts           # Anthropic client initialization
│   ├── tools.ts               # Tool definitions
│   ├── tool-executors.ts      # Tool implementation
│   ├── model-router.ts        # Haiku/Opus routing
│   ├── session.ts             # Session types
│   ├── session-store.ts       # Session storage
│   ├── prompts.ts             # System prompts (EN/MN)
│   └── language.ts            # Language detection

app/api/ai/
├── chat/
│   └── route.ts               # Main chat endpoint
└── confirm-action/
    └── route.ts               # Action confirmation endpoint

components/ai-chat/
├── ai-chat-sidebar.tsx
├── ai-chat-header.tsx
├── ai-chat-messages.tsx
├── ai-chat-message.tsx
├── ai-chat-input.tsx
├── ai-chat-tool-result.tsx
├── ai-chat-confirmation.tsx
├── ai-chat-loading.tsx
└── ai-chat-provider.tsx

types/
└── ai-chat.ts                 # TypeScript types
```

---

## 13. Environment Variables (New)

```env
# Add to .env.local

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Analytics/Logging
AI_CHAT_LOG_ENABLED=true
```

---

## 14. Security Considerations

1. **Authentication**: Every request validates Supabase session
2. **Authorization**: Role check (HR/Admin only)
3. **Data scoping**: Company-level users only see their data
4. **Action confirmation**: Destructive actions require explicit confirmation
5. **Rate limiting**: Consider adding rate limits to prevent abuse
6. **Input sanitization**: Tool inputs are validated with Zod schemas
7. **No PII in logs**: Chat logs don't store individual employee data

---

## 15. Cost Estimation

| Model | Input (1M tokens) | Output (1M tokens) |
|-------|-------------------|-------------------|
| Haiku 3.5 | $0.80 | $4.00 |
| Opus 4.5 | $15.00 | $75.00 |

**Estimated monthly cost** (100 HR users, 50 queries/user/month):
- 70% Haiku: ~$50-100/month
- 30% Opus: ~$150-300/month
- **Total: ~$200-400/month**

---

## Questions for You

1. Should we add **suggested quick actions** in the chat? (e.g., buttons like "Check Q1 survey progress")

2. Do you want **typing indicators** when AI is processing?

3. Should the sidebar **remember collapsed state** across page navigations?

4. Any specific **Mongolian terminology** for HR/survey terms I should know?
