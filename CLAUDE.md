# HR Survey AI Platform

## Project Overview
HR survey platform for holding companies. Main goal: AI-first interface 
where HR specialists interact via chat instead of clicking through UI.

## Tech Stack
- Frontend: [your stack]
- Backend: [your stack]  
- Database: [postgres/etc]
- AI: Claude API (opus-4.5 for chat, haiku for analysis)

## Current Features (Already Built)
1. Employee import + account creation
2. Survey form builder
3. Multi-company survey assignment
4. Progress tracking (cards + progress bars)
5. Email invitations + reminders (magic links)
6. PDF report generation
7. Sentiment analysis (existing AI server)

## AI Integration Goals
The sidebar chat should handle:
- "How's survey X progressing?" → Query DB, return natural language summary
- "Who hasn't responded?" → List + offer to send reminders
- "Remind the 12 people who haven't filled it" → Trigger email API
- "Create a new survey about workplace satisfaction" → Guide through creation
- "What's the sentiment on Q3?" → Call sentiment API, explain results
- "Generate the CEO report" → Trigger PDF generation

## Architecture Decisions
- Use streaming for chat responses
- Maintain conversation context per HR user
- AI should CONFIRM before taking actions (sending emails, etc.)
- Show "AI is checking..." states for DB queries

## Code Style
[your preferences]
```

---

## Prompt Strategy for Claude Code

### Initial Planning Prompt:
```
Read CLAUDE.md and the entire codebase. Then:

1. Map out what API endpoints already exist that the AI chat could call
2. Identify what NEW endpoints we need for AI-driven actions
3. Propose a conversation context schema (what does the AI need to 
   "remember" during a chat session?)
4. Suggest the file structure for the chat feature
5. List the 10 most likely user queries and how each would be handled

Don't write code yet. Just analyze and plan.
```

### After Planning, Build Incrementally:
```
Let's build the chat interface. Start with:
1. The sidebar UI component (collapsible, streaming messages)
2. A single working query: "How many employees are in company X?"

Get this one flow working end-to-end before we add more capabilities.
```

### For AI Response Design:
```
Act as an AI systems architect. For each of these user intents, design:
- What data needs to be fetched
- What the AI response template should look like
- What follow-up actions should be offered

Intents:
1. Check survey progress
2. List non-respondents  
3. Send reminder emails
4. Explain sentiment analysis results
5. Generate reports
```

---

## Architecture Suggestion
```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend                                │
│  ┌─────────────────┐  ┌──────────────────────────────────┐ │
│  │  Sidebar Chat   │  │      Main Dashboard               │ │
│  │  - Streaming    │  │  (existing UI stays functional)  │ │
│  │  - Context      │  │                                   │ │
│  └────────┬────────┘  └──────────────────────────────────┘ │
└───────────┼─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                   AI Chat Backend                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Claude API  │  │  Tool Calls │  │ Conversation Memory │ │
│  │  (opus-4.5) │  │ (your APIs) │  │  (per user/session) │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Your Existing Backend APIs                      │
│  /employees  /surveys  /responses  /emails  /reports  /ai   │
└─────────────────────────────────────────────────────────────┘