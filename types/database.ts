export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
        Relationships: [
          {
            foreignKeyName: "org_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activation_token: string | null
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
          invitation_status: string | null
          last_login_at: string | null
          org_unit_id: string | null
          phone_number: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          activation_token?: string | null
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
          invitation_status?: string | null
          last_login_at?: string | null
          org_unit_id?: string | null
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          activation_token?: string | null
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
          invitation_status?: string | null
          last_login_at?: string | null
          org_unit_id?: string | null
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
        ]
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
      survey_sentiment_analyses: {
        Row: {
          id: string
          survey_id: string
          status: string
          request_sent_at: string | null
          completed_at: string | null
          error_message: string | null
          results: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          survey_id: string
          status?: string
          request_sent_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          results?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          survey_id?: string
          status?: string
          request_sent_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          results?: Json | null
          created_at?: string | null
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
          id: string
          company_id: string
          name: string
          parent_id: string | null
          level_type: string
          sort_order: number | null
          level_depth: number
          path_names: string
          path_ids: string[]
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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

// Helper types for easier access to table row types
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
