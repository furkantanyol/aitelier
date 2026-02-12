export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      evaluations: {
        Row: {
          baseline_output: string | null
          baseline_score: number | null
          created_at: string
          example_id: string
          id: string
          model_output: string | null
          model_score: number | null
          preferred: string | null
          project_id: string
          scored_by: string | null
          training_run_id: string
        }
        Insert: {
          baseline_output?: string | null
          baseline_score?: number | null
          created_at?: string
          example_id: string
          id?: string
          model_output?: string | null
          model_score?: number | null
          preferred?: string | null
          project_id: string
          scored_by?: string | null
          training_run_id: string
        }
        Update: {
          baseline_output?: string | null
          baseline_score?: number | null
          created_at?: string
          example_id?: string
          id?: string
          model_output?: string | null
          model_score?: number | null
          preferred?: string | null
          project_id?: string
          scored_by?: string | null
          training_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_example_id_fkey"
            columns: ["example_id"]
            isOneToOne: false
            referencedRelation: "examples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_training_run_id_fkey"
            columns: ["training_run_id"]
            isOneToOne: false
            referencedRelation: "training_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      examples: {
        Row: {
          created_at: string
          created_by: string
          id: string
          input: string
          metadata: Json
          output: string
          project_id: string
          rated_at: string | null
          rated_by: string | null
          rating: number | null
          rewrite: string | null
          split: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          input: string
          metadata?: Json
          output: string
          project_id: string
          rated_at?: string | null
          rated_by?: string | null
          rating?: number | null
          rewrite?: string | null
          split?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          input?: string
          metadata?: Json
          output?: string
          project_id?: string
          rated_at?: string | null
          rated_by?: string | null
          rating?: number | null
          rewrite?: string | null
          split?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "examples_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          invited_at: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          invited_at?: string
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          invited_at?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          base_model: string
          created_at: string
          created_by: string
          id: string
          name: string
          provider: string
          provider_config: Json
          quality_threshold: number
          system_prompt: string | null
          training_config: Json
        }
        Insert: {
          base_model: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          provider?: string
          provider_config?: Json
          quality_threshold?: number
          system_prompt?: string | null
          training_config?: Json
        }
        Update: {
          base_model?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          provider?: string
          provider_config?: Json
          quality_threshold?: number
          system_prompt?: string | null
          training_config?: Json
        }
        Relationships: []
      }
      training_runs: {
        Row: {
          base_model: string
          completed_at: string | null
          config: Json
          cost_actual: number | null
          cost_estimate: number | null
          created_at: string
          created_by: string
          error: string | null
          example_count: number
          id: string
          model_id: string | null
          project_id: string
          provider: string
          provider_job_id: string | null
          started_at: string | null
          status: string
          train_count: number
          val_count: number
        }
        Insert: {
          base_model: string
          completed_at?: string | null
          config?: Json
          cost_actual?: number | null
          cost_estimate?: number | null
          created_at?: string
          created_by: string
          error?: string | null
          example_count?: number
          id?: string
          model_id?: string | null
          project_id: string
          provider: string
          provider_job_id?: string | null
          started_at?: string | null
          status?: string
          train_count?: number
          val_count?: number
        }
        Update: {
          base_model?: string
          completed_at?: string | null
          config?: Json
          cost_actual?: number | null
          cost_estimate?: number | null
          created_at?: string
          created_by?: string
          error?: string | null
          example_count?: number
          id?: string
          model_id?: string | null
          project_id?: string
          provider?: string
          provider_job_id?: string | null
          started_at?: string | null
          status?: string
          train_count?: number
          val_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_project_role: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: string
      }
      is_project_member: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
