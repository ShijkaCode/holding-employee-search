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
          avatar_url: string | null
          company_id: string | null
          created_at: string | null
          department: string | null
          email: string | null
          employee_id: string | null
          full_name: string
          id: string
          org_unit_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          employee_id?: string | null
          full_name: string
          id: string
          org_unit_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string
          id?: string
          org_unit_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "survey_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_assignments_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "survey_responses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          deadline: string | null
          description: string | null
          id: string
          settings: Json | null
          status: Database["public"]["Enums"]["survey_status"]
          title: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          settings?: Json | null
          status?: Database["public"]["Enums"]["survey_status"]
          title: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          settings?: Json | null
          status?: Database["public"]["Enums"]["survey_status"]
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      department_stats: {
        Row: {
          company_id: string | null
          completion_rate: number | null
          department: string | null
          survey_id: string | null
          total_assigned: number | null
          total_completed: number | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      survey_stats: {
        Row: {
          company_id: string | null
          completion_rate: number | null
          deadline: string | null
          status: Database["public"]["Enums"]["survey_status"] | null
          survey_id: string | null
          title: string | null
          total_assigned: number | null
          total_completed: number | null
          total_partial: number | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_incomplete_survey_employees: {
        Args: { p_survey_id: string }
        Returns: {
          department: string
          email: string
          employee_id: string
          full_name: string
          response_status: Database["public"]["Enums"]["response_status"]
        }[]
      }
      get_org_unit_descendants: {
        Args: { p_unit_id: string }
        Returns: {
          id: string
          name: string
          level_depth: number
        }[]
      }
      get_org_unit_employee_count: {
        Args: { p_unit_id: string }
        Returns: number
      }
      get_org_unit_path: {
        Args: { p_unit_id: string }
        Returns: string
      }
      get_org_unit_survey_stats: {
        Args: { p_survey_id: string; p_unit_id: string }
        Returns: {
          total_assigned: number
          total_completed: number
          total_partial: number
          total_pending: number
          completion_rate: number
        }[]
      }
      get_user_company_id: { Args: Record<string, never>; Returns: string }
      get_user_role: {
        Args: Record<string, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
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

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"]
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T]

// Convenience types for org_units
export type OrgUnit = Tables<"org_units">
export type OrgUnitInsert = Database["public"]["Tables"]["org_units"]["Insert"]
export type OrgUnitUpdate = Database["public"]["Tables"]["org_units"]["Update"]

// Convenience type for org_hierarchy view
export type OrgHierarchy = Views<"org_hierarchy">
