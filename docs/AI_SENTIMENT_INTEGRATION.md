# AI Sentiment Analysis Integration Guide

## Overview

Survey system sends JSON data to your AI server. After processing, call our webhook with results.

---

## Your Server Requirements

### 1. Receive Endpoint
```
POST /analyze
Content-Type: application/json
```

### 2. Health Check Endpoint
```
GET /health
Response: 200 OK
```

---

## Request Format (What You Receive)

```json
{
  "survey": {
    "id": "uuid",
    "title": "Employee Satisfaction Survey",
    "description": "...",
    "created_at": "2024-01-15T10:00:00Z"
  },
  "questions": [
    {
      "code": "1.Q1",
      "text": "How satisfied are you with your work environment?",
      "type": "scale",
      "section": "Work Environment",
      "options": null
    },
    {
      "code": "2.Q1",
      "text": "Which benefits do you prefer?",
      "type": "multiple_choice",
      "section": "Benefits",
      "options": ["Health insurance", "Remote work", "Training"]
    }
  ],
  "responses": [
    {
      "id": "response-uuid",
      "submitted_at": "2024-01-20T14:30:00Z",
      "answers": [
        {
          "question_code": "1.Q1",
          "question_type": "scale",
          "value": "5",
          "value_type": "numeric"
        },
        {
          "question_code": "2.Q1",
          "question_type": "multiple_choice",
          "value": ["Health insurance", "Remote work"],
          "value_type": "multi_selection"
        }
      ]
    }
  ],
  "metadata": {
    "total_responses": 45,
    "export_date": "2024-01-25T10:00:00Z",
    "callback_url": "https://app.example.com/api/surveys/{id}/sentiment-callback",
    "analysis_id": "analysis-uuid"
  }
}
```

---

## Question Types

| type | value_type | value format |
|------|------------|--------------|
| `scale` | `numeric` | "1" to "5" |
| `rating` | `numeric` | "1" to "5" |
| `text` | `text` | Free text string |
| `single_choice` | `selection` | Single string |
| `multiple_choice` | `multi_selection` | Array of strings |
| `date` | `date` | "YYYY-MM-DD" |

---

## Response Format (What You Send Back)

### On Success - POST to callback_url

```
POST {callback_url}
Authorization: Bearer {CALLBACK_SECRET}
Content-Type: application/json
```

```json
{
  "analysis_id": "analysis-uuid",
  "survey_id": "survey-uuid",
  "overall_sentiment": "positive",
  "confidence_score": 0.85,
  "summary": "Overall employee satisfaction is high...",
  "question_sentiments": [
    {
      "question_code": "1.Q1",
      "sentiment": "positive",
      "key_themes": ["safe environment", "good facilities"]
    },
    {
      "question_code": "3.Q1",
      "sentiment": "neutral",
      "key_themes": ["communication", "teamwork"],
      "sample_responses": ["Need more team activities"]
    }
  ],
  "recommendations": [
    "Improve team communication channels",
    "Consider flexible work hours"
  ],
  "processed_at": "2024-01-25T12:00:00Z"
}
```

### On Failure - PUT to callback_url

```
PUT {callback_url}
Authorization: Bearer {CALLBACK_SECRET}
Content-Type: application/json
```

```json
{
  "analysis_id": "analysis-uuid",
  "error": "Insufficient responses for analysis"
}
```

---

## Sentiment Values

- `positive`
- `neutral`
- `negative`
- `mixed`

---

## Authentication

If `SENTIMENT_AI_API_KEY` is configured, requests will include:
```
Authorization: Bearer {API_KEY}
```

Your callback must include:
```
Authorization: Bearer {CALLBACK_SECRET}
```

---

## Flow Diagram

```
┌─────────────┐                    ┌─────────────┐
│ Survey App  │  POST /analyze     │  AI Server  │
│             │ ────────────────►  │             │
│             │  (survey JSON)     │             │
└─────────────┘                    └─────────────┘
                                          │
      ┌───────────────────────────────────┘
      │ POST callback_url (results)
      ▼
┌─────────────┐
│ Survey App  │  ──► Store results
└─────────────┘
```

---

## Environment Variables (Our Side)

```env
SENTIMENT_AI_SERVER_URL=http://your-server.com
SENTIMENT_AI_API_KEY=your-api-key
SENTIMENT_CALLBACK_SECRET=shared-secret
```

Share `SENTIMENT_CALLBACK_SECRET` with me for callback authentication.

---
