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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          ai_bullets: Json
          ai_capabilities: string[]
          ai_capable: string
          categories: string[]
          clarity: string
          commitment: string
          created_at: string
          hours_saved: number
          how_to: string | null
          id: string
          name: string
          recommended_tool: string | null
          updated_at: string
          user_id: string
          weekly_hours: number
        }
        Insert: {
          ai_bullets?: Json
          ai_capabilities?: string[]
          ai_capable?: string
          categories?: string[]
          clarity?: string
          commitment?: string
          created_at?: string
          hours_saved?: number
          how_to?: string | null
          id?: string
          name?: string
          recommended_tool?: string | null
          updated_at?: string
          user_id: string
          weekly_hours?: number
        }
        Update: {
          ai_bullets?: Json
          ai_capabilities?: string[]
          ai_capable?: string
          categories?: string[]
          clarity?: string
          commitment?: string
          created_at?: string
          hours_saved?: number
          how_to?: string | null
          id?: string
          name?: string
          recommended_tool?: string | null
          updated_at?: string
          user_id?: string
          weekly_hours?: number
        }
        Relationships: []
      }
      ai_fit_attempts: {
        Row: {
          answers: Json
          company_id: string | null
          created_at: string
          id: string
          score: number
          total: number
          user_id: string
        }
        Insert: {
          answers?: Json
          company_id?: string | null
          created_at?: string
          id?: string
          score?: number
          total?: number
          user_id: string
        }
        Update: {
          answers?: Json
          company_id?: string | null
          created_at?: string
          id?: string
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_fit_questions: {
        Row: {
          choice_avoid_label: string
          choice_partial_label: string
          choice_use_label: string
          correct_answer: string
          created_at: string
          id: string
          is_active: boolean
          rationale: string
          scenario: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          choice_avoid_label?: string
          choice_partial_label?: string
          choice_use_label?: string
          correct_answer: string
          created_at?: string
          id?: string
          is_active?: boolean
          rationale: string
          scenario: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          choice_avoid_label?: string
          choice_partial_label?: string
          choice_use_label?: string
          correct_answer?: string
          created_at?: string
          id?: string
          is_active?: boolean
          rationale?: string
          scenario?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      cab_assessments: {
        Row: {
          company_id: string | null
          created_at: string
          final_level: string
          final_level_name: string
          id: string
          level_scores: Json
          note: string | null
          selected_question_ids: Json
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          final_level: string
          final_level_name: string
          id?: string
          level_scores?: Json
          note?: string | null
          selected_question_ids?: Json
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          final_level?: string
          final_level_name?: string
          id?: string
          level_scores?: Json
          note?: string | null
          selected_question_ids?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cab_assessments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cab_level_definitions: {
        Row: {
          cab_level: string
          created_at: string
          description: string
          id: string
          level_name: string
          next_move: string
          recommended_actions: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          cab_level: string
          created_at?: string
          description: string
          id?: string
          level_name: string
          next_move: string
          recommended_actions?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cab_level?: string
          created_at?: string
          description?: string
          id?: string
          level_name?: string
          next_move?: string
          recommended_actions?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      cab_questions: {
        Row: {
          cab_level: string
          created_at: string
          example_text: string | null
          id: string
          is_active: boolean
          question_text: string
          sort_order: number
          updated_at: string
          weight: number
        }
        Insert: {
          cab_level: string
          created_at?: string
          example_text?: string | null
          id?: string
          is_active?: boolean
          question_text: string
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Update: {
          cab_level?: string
          created_at?: string
          example_text?: string | null
          id?: string
          is_active?: boolean
          question_text?: string
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      commitments: {
        Row: {
          created_at: string
          id: string
          position: number
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position: number
          text?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_admin: boolean
          role: string | null
          username: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id: string
          is_admin?: boolean
          role?: string | null
          username: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_admin?: boolean
          role?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { _uid: string }; Returns: boolean }
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
