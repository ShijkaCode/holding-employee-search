export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          latency_ms: number | null
          role: string
          session_id: string
          tokens_in: number | null
          tokens_out: number | null
          tool_input: Json | null
          tool_name: string | null
          tool_output: Json | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          role: string
          session_id: string
          tokens_in?: number | null
          tokens_out?: number | null
          tool_input?: Json | null
          tool_name?: string | null
          tool_output?: Json | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          role?: string
          session_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
          tool_input?: Json | null
          tool_name?: string | null
          tool_output?: Json | null
        }
        Relationships: []
      }
      ai_preferences: {
        Row: {
          auto_execute_level: string
          company_id: string | null
          created_at: string
          id: string
          locale: string | null
          metadata: Json
          response_style: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_execute_level?: string
          company_id?: string | null
          created_at?: string
          id?: string
          locale?: string | null
          metadata?: Json
          response_style?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_execute_level?: string
          company_id?: string | null
          created_at?: string
          id?: string
          locale?: string | null
          metadata?: Json
          response_style?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_sessions: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          locale: string | null
          metadata: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          locale?: string | null
          metadata?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          locale?: string | null
          metadata?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_task_steps: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          error: string | null
          id: string
          input: Json | null
          output: Json | null
          requires_approval: boolean
          status: string
          step_order: number
          task_id: string
          tool_name: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          requires_approval?: boolean
          status?: string
          step_order?: number
          task_id: string
          tool_name?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          requires_approval?: boolean
          status?: string
          step_order?: number
          task_id?: string
          tool_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_tasks: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          goal: string | null
          id: string
          metadata: Json
          priority: number
          session_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by: string
          goal?: string | null
          id?: string
          metadata?: Json
          priority?: number
          session_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          goal?: string | null
          id?: string
          metadata?: Json
          priority?: number
          session_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_tool_runs: {
        Row: {
          completed_at: string | null
          error: string | null
          id: string
          input: Json | null
          latency_ms: number | null
          message_id: string | null
          output: Json | null
          session_id: string
          started_at: string
          status: string
          tool_name: string
        }
        Insert: {
          completed_at?: string | null
          error?: string | null
          id?: string
          input?: Json | null
          latency_ms?: number | null
          message_id?: string | null
          output?: Json | null
          session_id: string
          started_at?: string
          status?: string
          tool_name: string
        }
        Update: {
          completed_at?: string | null
          error?: string | null
          id?: string
          input?: Json | null
          latency_ms?: number | null
          message_id?: string | null
          output?: Json | null
          session_id?: string
          started_at?: string
          status?: string
          tool_name?: string
        }
        Relationships: []
      }
      ai_usage_daily: {
        Row: {
          requests: number
          tokens_in: number
          tokens_out: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          requests?: number
          tokens_in?: number
          tokens_out?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          requests?: number
          tokens_in?: number
          tokens_out?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      org_units: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          level_depth: number
          level_type: string
          name: string
          parent_id: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          level_depth?: number
          level_type?: string
          name: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          level_depth?: number
          level_type?: string
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activation_token: string | null
          activation_token_expires_at: string | null
          activation_token_hash: string | null
          auth_method: string | null
          avatar_url: string | null
          company_id: string | null
          created_at: string | null
          department: string | null
          email: string | null
          employee_id: string | null
          first_login_at: string | null
          full_name: string
          id: string
          invitation_consumed_at: string | null
          invitation_status: string | null
          last_login_at: string | null
          org_unit_id: string | null
          phone_number: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          activation_token?: string | null
          activation_token_expires_at?: string | null
          activation_token_hash?: string | null
          auth_method?: string | null
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          employee_id?: string | null
          first_login_at?: string | null
          full_name: string
          id: string
          invitation_consumed_at?: string | null
          invitation_status?: string | null
          last_login_at?: string | null
          org_unit_id?: string | null
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          activation_token?: string | null
          activation_token_expires_at?: string | null
          activation_token_hash?: string | null
          auth_method?: string | null
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          employee_id?: string | null
          first_login_at?: string | null
          full_name?: string
          id?: string
          invitation_consumed_at?: string | null
          invitation_status?: string | null
          last_login_at?: string | null
          org_unit_id?: string | null
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          updated_at: string
          window_seconds: number
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          updated_at?: string
          window_seconds?: number
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          updated_at?: string
          window_seconds?: number
          window_start?: string
        }
        Relationships: []
      }
      survey_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          employee_id: string
          id: string
          notified_at: string | null
          reminder_count: number | null
          survey_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          employee_id: string
          id?: string
          notified_at?: string | null
          reminder_count?: number | null
          survey_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          employee_id?: string
          id?: string
          notified_at?: string | null
          reminder_count?: number | null
          survey_id?: string
        }
        Relationships: []
      }
      survey_company_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          company_id: string
          created_at: string | null
          id: string
          survey_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          survey_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          survey_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      survey_invitations: {
        Row: {
          assignment_id: string
          bounce_reason: string | null
          clicked_at: string | null
          completed_at: string | null
          created_at: string | null
          delivered_at: string | null
          employee_id: string
          error_message: string | null
          id: string
          last_retry_at: string | null
          method: string
          retry_count: number | null
          sent_at: string | null
          sent_to: string
          status: string | null
          survey_id: string
          updated_at: string | null
        }
        Insert: {
          assignment_id: string
          bounce_reason?: string | null
          clicked_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          employee_id: string
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          method: string
          retry_count?: number | null
          sent_at?: string | null
          sent_to: string
          status?: string | null
          survey_id: string
          updated_at?: string | null
        }
        Update: {
          assignment_id?: string
          bounce_reason?: string | null
          clicked_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          employee_id?: string
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          method?: string
          retry_count?: number | null
          sent_at?: string | null
          sent_to?: string
          status?: string | null
          survey_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      survey_questions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_required: boolean | null
          options: Json | null
          question_code: string
          question_order: number | null
          question_text: string
          section_name: string | null
          section_order: number | null
          survey_id: string
          type: Database["public"]["Enums"]["question_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_required?: boolean | null
          options?: Json | null
          question_code: string
          question_order?: number | null
          question_text: string
          section_name?: string | null
          section_order?: number | null
          survey_id: string
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_required?: boolean | null
          options?: Json | null
          question_code?: string
          question_order?: number | null
          question_text?: string
          section_name?: string | null
          section_order?: number | null
          survey_id?: string
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          answers: Json | null
          company_id: string
          created_at: string | null
          employee_id: string
          id: string
          last_saved_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["response_status"]
          submitted_at: string | null
          survey_id: string
          updated_at: string | null
        }
        Insert: {
          answers?: Json | null
          company_id: string
          created_at?: string | null
          employee_id: string
          id?: string
          last_saved_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["response_status"]
          submitted_at?: string | null
          survey_id: string
          updated_at?: string | null
        }
        Update: {
          answers?: Json | null
          company_id?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          last_saved_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["response_status"]
          submitted_at?: string | null
          survey_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      survey_sentiment_analyses: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          request_sent_at: string | null
          results: Json | null
          status: string
          survey_id: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          request_sent_at?: string | null
          results?: Json | null
          status?: string
          survey_id: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          request_sent_at?: string | null
          results?: Json | null
          status?: string
          survey_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      surveys: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          created_by_role: string | null
          deadline: string | null
          description: string | null
          id: string
          scope: string | null
          settings: Json | null
          status: Database["public"]["Enums"]["survey_status"]
          title: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_role?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          scope?: string | null
          settings?: Json | null
          status?: Database["public"]["Enums"]["survey_status"]
          title: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_role?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          scope?: string | null
          settings?: Json | null
          status?: Database["public"]["Enums"]["survey_status"]
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      holding_survey_company_stats: {
        Row: {
          company_id: string | null
          company_name: string | null
          completion_rate: number | null
          survey_id: string | null
          total_assigned: number | null
          total_completed: number | null
          total_partial: number | null
        }
        Relationships: []
      }
      org_hierarchy: {
        Row: {
          ancestors: string[] | null
          company_id: string | null
          id: string | null
          level_depth: number | null
          level_type: string | null
          name: string | null
          parent_id: string | null
          path_ids: string | null
          path_names: string | null
          sort_order: number | null
          sort_path: number[] | null
        }
        Relationships: []
      }
      org_unit_stats: {
        Row: {
          company_id: string | null
          completion_rate: number | null
          level_depth: number | null
          level_type: string | null
          org_unit_id: string | null
          org_unit_name: string | null
          survey_id: string | null
          total_assigned: number | null
          total_completed: number | null
        }
        Relationships: []
      }
      department_stats: {
        Row: {
          company_id: string | null
          completion_rate: number | null
          department: string | null
          survey_id: string | null
          total_assigned: number | null
          total_completed: number | null
        }
        Relationships: []
      }
      survey_stats: {
        Row: {
          company_id: string | null
          completion_rate: number | null
          created_at: string | null
          deadline: string | null
          description: string | null
          scope: string | null
          status: Database["public"]["Enums"]["survey_status"] | null
          survey_id: string | null
          title: string | null
          total_assigned: number | null
          total_completed: number | null
          total_partial: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      ai_usage_increment: {
        Args: { p_tokens_in: number; p_tokens_out: number; p_user_id: string }
        Returns: {
          requests_total: number
          tokens_in_total: number
          tokens_out_total: number
        }[]
      }
      rate_limit_hit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          current_count: number
          reset_at: string
        }[]
      }
      rate_limit_gc: { Args: never; Returns: number }
    }
    Enums: {
      question_type:
        | "text"
        | "scale"
        | "multiple_choice"
        | "single_choice"
        | "file"
        | "rating"
        | "date"
      response_status: "pending" | "partial" | "completed"
      survey_status: "draft" | "active" | "closed"
      user_role: "admin" | "hr" | "specialist" | "employee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Simple helper types — preserved from the previous file to avoid breaking call sites
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// Sentiment Analysis Types
export type SentimentAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface SurveyExportQuestion {
  code: string
  text: string
  type: Enums<'question_type'>
  section: string | null
  options: string[] | null
}

export interface SurveyExportAnswer {
  question_code: string
  question_type: Enums<'question_type'>
  value: string | string[] | null
  value_type: 'numeric' | 'text' | 'selection' | 'multi_selection' | 'date'
}

export interface SurveyExportResponse {
  id: string
  submitted_at: string | null
  answers: SurveyExportAnswer[]
}

export interface SurveyExportJSON {
  survey: {
    id: string
    title: string
    description: string | null
    created_at: string | null
  }
  questions: SurveyExportQuestion[]
  responses: SurveyExportResponse[]
  metadata: {
    total_responses: number
    export_date: string
    callback_url: string
    analysis_id: string
  }
}

export interface SentimentAnalysisResult {
  analysis_id: string
  survey_id: string
  overall_sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
  confidence_score: number
  summary: string
  question_sentiments: {
    question_code: string
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
    key_themes: string[]
    sample_responses?: string[]
  }[]
  recommendations?: string[]
  processed_at: string
}
