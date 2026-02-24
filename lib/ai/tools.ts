import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { GetSurveyProgressInput, SurveyProgressResult } from '@/lib/ai/tools/get-survey-progress'
import type { GetNonRespondentsInput, NonRespondentsResult } from '@/lib/ai/tools/get-non-respondents'
import type { GetInvitationStatusInput, InvitationStatusResult } from '@/lib/ai/tools/get-invitation-status'
import type { GetSurveysInput, SurveyListResult } from '@/lib/ai/tools/get-surveys'
import type { GetCompaniesInput, CompanyListResult } from '@/lib/ai/tools/get-companies'
import type { CreateSurveyInput, CreateSurveyResult } from '@/lib/ai/tools/create-survey'
import type { AddSurveyQuestionsInput, AddSurveyQuestionsResult } from '@/lib/ai/tools/add-survey-questions'
import type { AssignSurveyToCompaniesInput } from '@/lib/ai/tools/assign-survey-to-companies'
import type { SendSurveyInvitationsInput } from '@/lib/ai/tools/send-survey-invitations'
import type {
  SurveyLookupInput,
  SurveyStatusChangeResult,
  ReportDataResult,
  SentimentTriggerResult,
  SentimentResultsData,
} from '@/lib/ai/data-access'
import type { ConfirmableToolResult } from '@/lib/ai/agent'

// --- Confirmable action types ---

export type ConfirmableActionType =
  | 'send_reminders'
  | 'activate_survey'
  | 'close_survey'
  | 'trigger_sentiment_analysis'
  | 'assign_survey_to_companies'
  | 'send_survey_invitations'

export const CONFIRMABLE_TOOLS = new Set<string>([
  'send_reminders',
  'activate_survey',
  'close_survey',
  'trigger_sentiment_analysis',
  'assign_survey_to_companies',
  'send_survey_invitations',
])

// --- Survey lookup input schema (shared by multiple tools) ---

const SURVEY_LOOKUP_PROPERTIES = {
  surveyId: {
    type: 'string' as const,
    description: 'UUID of the survey.',
  },
  title: {
    type: 'string' as const,
    description: 'Survey title or partial title for fuzzy matching.',
  },
  latest: {
    type: 'boolean' as const,
    description: 'Set to true to target the most recently created survey.',
  },
}

// --- Claude Tool Definitions ---

export const TOOL_DEFINITIONS: Tool[] = [
  // --- Phase 1: Read tools ---
  {
    name: 'get_survey_progress',
    description:
      'Get survey completion progress and statistics. Can look up by survey ID, title (fuzzy match), or get the latest survey. For holding-level surveys, returns per-company breakdown.',
    input_schema: {
      type: 'object' as const,
      properties: {
        surveyId: {
          type: 'string',
          description: 'UUID of the survey. Use this if the user provided a specific ID.',
        },
        title: {
          type: 'string',
          description: 'Survey title or partial title for fuzzy matching.',
        },
        latest: {
          type: 'boolean',
          description: 'Set to true to get the most recently created survey.',
        },
      },
    },
  },
  {
    name: 'get_non_respondents',
    description:
      'Get a list of employees who have not completed a specific survey. Returns employee names, emails, departments. Useful when the user asks who hasn\'t responded, who is pending, who is slacking, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        surveyId: { type: 'string', description: 'UUID of the survey.' },
        title: { type: 'string', description: 'Survey title or partial title for fuzzy matching.' },
        latest: { type: 'boolean', description: 'Set to true to check the most recently created survey.' },
        limit: { type: 'number', description: 'Maximum number of employees to return (1-200, default 50).' },
      },
    },
  },
  {
    name: 'get_invitation_status',
    description:
      'Get email invitation delivery statistics for a survey. Shows how many invitations were sent, delivered, clicked, completed, failed, or bounced.',
    input_schema: {
      type: 'object' as const,
      properties: SURVEY_LOOKUP_PROPERTIES,
    },
  },
  {
    name: 'get_surveys',
    description:
      'List surveys with optional status filter. Use this when the user wants to see what surveys exist, how many there are, or browse by status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'active', 'closed', 'all'],
          description: 'Filter by survey status. Default is "all".',
        },
        limit: { type: 'number', description: 'Maximum number of surveys to return (1-50, default 10).' },
      },
    },
  },

  // --- Phase 2: Write/action tools ---
  {
    name: 'send_reminders',
    description:
      'Send reminder emails to employees who have not completed a survey. This action requires user confirmation before executing. Always call get_non_respondents first to know who needs reminders, then call this tool.',
    input_schema: {
      type: 'object' as const,
      properties: SURVEY_LOOKUP_PROPERTIES,
    },
  },
  {
    name: 'activate_survey',
    description:
      'Activate a draft survey, changing its status from "draft" to "active". Only draft surveys can be activated. This action requires user confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: SURVEY_LOOKUP_PROPERTIES,
    },
  },
  {
    name: 'close_survey',
    description:
      'Close an active survey, changing its status from "active" to "closed". Only active surveys can be closed. Closed surveys no longer accept responses. This action requires user confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: SURVEY_LOOKUP_PROPERTIES,
    },
  },
  {
    name: 'get_report_data',
    description:
      'Get report data and a link to the PDF report page for a survey. Returns question count, response count, completion rate, and the report URL. Use when the user asks to generate, view, or download a report.',
    input_schema: {
      type: 'object' as const,
      properties: SURVEY_LOOKUP_PROPERTIES,
    },
  },
  {
    name: 'trigger_sentiment_analysis',
    description:
      'Trigger AI sentiment analysis on completed survey responses. Only admins and specialists can use this. This action requires user confirmation. Use when the user asks to analyze sentiment, run AI analysis, or understand how employees feel.',
    input_schema: {
      type: 'object' as const,
      properties: SURVEY_LOOKUP_PROPERTIES,
    },
  },
  {
    name: 'get_sentiment_results',
    description:
      'Get the results of a previously run sentiment analysis for a survey. Returns analysis status, completion time, and results data. Use when the user asks about sentiment results, analysis findings, or employee mood/feelings.',
    input_schema: {
      type: 'object' as const,
      properties: SURVEY_LOOKUP_PROPERTIES,
    },
  },

  // --- Phase 3: Survey creation workflow tools ---
  {
    name: 'get_companies',
    description:
      'List all companies in the holding with their employee counts. Use this before assigning a survey to companies, or when the user asks about companies/subsidiaries. Admin and specialist only.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'create_survey',
    description:
      'Create a new survey in draft status. The survey starts as a draft and is invisible to employees until activated. Admin and specialist only. For holding-scope surveys (default), no companyId is needed. For company-scope surveys, provide a companyId.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Survey title (2-200 characters).',
        },
        scope: {
          type: 'string',
          enum: ['holding', 'company'],
          description: 'Survey scope. "holding" spans all companies, "company" is for a single company. Defaults to "holding".',
        },
        description: {
          type: 'string',
          description: 'Optional survey description (max 2000 characters).',
        },
        deadline: {
          type: 'string',
          description: 'Optional deadline in ISO 8601 format (e.g., "2025-03-15T00:00:00Z").',
        },
        companyId: {
          type: 'string',
          description: 'Required for company-scope surveys. UUID of the target company.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'add_survey_questions',
    description:
      'Add a batch of questions (1-50) to a draft survey. Only works on draft surveys. For choice-type questions (multiple_choice, single_choice), provide at least 2 options. Question types: text, scale, multiple_choice, single_choice, rating, date.',
    input_schema: {
      type: 'object' as const,
      properties: {
        surveyId: {
          type: 'string',
          description: 'UUID of the draft survey to add questions to.',
        },
        questions: {
          type: 'array',
          description: 'Array of questions to add (1-50).',
          items: {
            type: 'object',
            properties: {
              question_code: {
                type: 'string',
                description: 'Unique code for the question (e.g., "Q1", "SAT_01").',
              },
              question_text: {
                type: 'string',
                description: 'The question text displayed to employees.',
              },
              type: {
                type: 'string',
                enum: ['text', 'scale', 'multiple_choice', 'single_choice', 'rating', 'date'],
                description: 'Question type.',
              },
              options: {
                type: 'array',
                items: { type: 'string' },
                description: 'Answer options (required for multiple_choice and single_choice, min 2).',
              },
              section_name: {
                type: 'string',
                description: 'Optional section/category name for grouping questions.',
              },
              is_required: {
                type: 'boolean',
                description: 'Whether the question is mandatory. Defaults to true.',
              },
              description: {
                type: 'string',
                description: 'Optional helper text or description for the question.',
              },
            },
            required: ['question_code', 'question_text', 'type'],
          },
        },
      },
      required: ['surveyId', 'questions'],
    },
  },
  {
    name: 'assign_survey_to_companies',
    description:
      'Assign a holding-scope draft survey to one or more companies. This also creates employee assignments for all employees in those companies. This action requires user confirmation. Use get_companies first to see available companies.',
    input_schema: {
      type: 'object' as const,
      properties: {
        surveyId: {
          type: 'string',
          description: 'UUID of the holding-scope draft survey.',
        },
        companyIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of company UUIDs to assign the survey to.',
        },
      },
      required: ['surveyId', 'companyIds'],
    },
  },
  {
    name: 'send_survey_invitations',
    description:
      'Send magic-link email invitations to employees assigned to a survey. Only works on active surveys. This action requires user confirmation. Optionally filter by a specific company.',
    input_schema: {
      type: 'object' as const,
      properties: {
        surveyId: {
          type: 'string',
          description: 'UUID of the active survey.',
        },
        companyId: {
          type: 'string',
          description: 'Optional company UUID to only send invitations to employees of a specific company.',
        },
      },
      required: ['surveyId'],
    },
  },
]

// --- Tool Executor Types ---

export interface ToolExecutors {
  get_survey_progress: (input: GetSurveyProgressInput) => Promise<SurveyProgressResult>
  get_non_respondents: (input: GetNonRespondentsInput) => Promise<NonRespondentsResult>
  get_invitation_status: (input: GetInvitationStatusInput) => Promise<InvitationStatusResult>
  get_surveys: (input: GetSurveysInput) => Promise<SurveyListResult>
  send_reminders: (input: SurveyLookupInput) => Promise<ConfirmableToolResult | Record<string, unknown>>
  activate_survey: (input: SurveyLookupInput) => Promise<ConfirmableToolResult>
  close_survey: (input: SurveyLookupInput) => Promise<ConfirmableToolResult>
  get_report_data: (input: SurveyLookupInput) => Promise<ReportDataResult>
  trigger_sentiment_analysis: (input: SurveyLookupInput) => Promise<ConfirmableToolResult | Record<string, unknown>>
  get_sentiment_results: (input: SurveyLookupInput) => Promise<SentimentResultsData>
  get_companies: (input: GetCompaniesInput) => Promise<CompanyListResult>
  create_survey: (input: CreateSurveyInput) => Promise<CreateSurveyResult>
  add_survey_questions: (input: AddSurveyQuestionsInput) => Promise<AddSurveyQuestionsResult>
  assign_survey_to_companies: (input: AssignSurveyToCompaniesInput) => Promise<ConfirmableToolResult>
  send_survey_invitations: (input: SendSurveyInvitationsInput) => Promise<ConfirmableToolResult>
}

export type ToolName = keyof ToolExecutors

export function isValidToolName(name: string): name is ToolName {
  return name in TOOL_NAME_SET
}

const TOOL_NAME_SET: Record<string, true> = {
  get_survey_progress: true,
  get_non_respondents: true,
  get_invitation_status: true,
  get_surveys: true,
  send_reminders: true,
  activate_survey: true,
  close_survey: true,
  get_report_data: true,
  trigger_sentiment_analysis: true,
  get_sentiment_results: true,
  get_companies: true,
  create_survey: true,
  add_survey_questions: true,
  assign_survey_to_companies: true,
  send_survey_invitations: true,
}
