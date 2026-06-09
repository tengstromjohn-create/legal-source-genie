export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      action_items: {
        Row: {
          bank_id: string
          created_at: string | null
          deadline: string | null
          id: string
          module: number
          owner: string | null
          priority: string
          source: string | null
          status: string
          title: string
        }
        Insert: {
          bank_id: string
          created_at?: string | null
          deadline?: string | null
          id?: string
          module: number
          owner?: string | null
          priority?: string
          source?: string | null
          status?: string
          title: string
        }
        Update: {
          bank_id?: string
          created_at?: string | null
          deadline?: string | null
          id?: string
          module?: number
          owner?: string | null
          priority?: string
          source?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          created_at: string | null
          id: string
          name: string
          org_number: string | null
          size_category: string | null
          subscription_tier: string | null
          total_risk_score: number | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          org_number?: string | null
          size_category?: string | null
          subscription_tier?: string | null
          total_risk_score?: number | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          org_number?: string | null
          size_category?: string | null
          subscription_tier?: string | null
          total_risk_score?: number | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "banks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_items: {
        Row: {
          bank_id: string
          created_at: string | null
          deadline: string
          id: string
          module: number
          notes: string | null
          owner: string | null
          recurrence: string | null
          status: string
          title: string
        }
        Insert: {
          bank_id: string
          created_at?: string | null
          deadline: string
          id?: string
          module: number
          notes?: string | null
          owner?: string | null
          recurrence?: string | null
          status?: string
          title: string
        }
        Update: {
          bank_id?: string
          created_at?: string | null
          deadline?: string
          id?: string
          module?: number
          notes?: string | null
          owner?: string | null
          recurrence?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_items_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_chunk: {
        Row: {
          char_end: number | null
          char_start: number | null
          chunk_index: number
          created_at: string
          error: string | null
          id: string
          job_id: string
          lagrum_ref: string | null
          requirements_found: number
          status: string
        }
        Insert: {
          char_end?: number | null
          char_start?: number | null
          chunk_index: number
          created_at?: string
          error?: string | null
          id?: string
          job_id: string
          lagrum_ref?: string | null
          requirements_found?: number
          status?: string
        }
        Update: {
          char_end?: number | null
          char_start?: number | null
          chunk_index?: number
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string
          lagrum_ref?: string | null
          requirements_found?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_chunk_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "extraction_job"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_job: {
        Row: {
          created_at: string
          error: string | null
          id: string
          legal_source_id: number
          model: string | null
          processed_chunks: number
          requirements_found: number
          status: string
          total_chunks: number
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          legal_source_id: number
          model?: string | null
          processed_chunks?: number
          requirements_found?: number
          status?: string
          total_chunks?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          legal_source_id?: number
          model?: string | null
          processed_chunks?: number
          requirements_found?: number
          status?: string
          total_chunks?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extraction_job_legal_source_id_fkey"
            columns: ["legal_source_id"]
            isOneToOne: false
            referencedRelation: "legal_source"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_job_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_source: {
        Row: {
          created_at: string | null
          embedding: string | null
          full_text: string
          id: number
          lagrum: string
          referens: string | null
          regelverk_name: string
          typ: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          full_text: string
          id?: number
          lagrum: string
          referens?: string | null
          regelverk_name: string
          typ: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          full_text?: string
          id?: number
          lagrum?: string
          referens?: string | null
          regelverk_name?: string
          typ?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_source_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      model_verdict: {
        Row: {
          agrees: boolean | null
          confidence: number | null
          created_at: string
          id: string
          issues: string[] | null
          model: string | null
          provider: string | null
          raw: Json | null
          requirement_id: number
          role: string
          suggested_lagrum: string | null
        }
        Insert: {
          agrees?: boolean | null
          confidence?: number | null
          created_at?: string
          id?: string
          issues?: string[] | null
          model?: string | null
          provider?: string | null
          raw?: Json | null
          requirement_id: number
          role: string
          suggested_lagrum?: string | null
        }
        Update: {
          agrees?: boolean | null
          confidence?: number | null
          created_at?: string
          id?: string
          issues?: string[] | null
          model?: string | null
          provider?: string | null
          raw?: Json | null
          requirement_id?: number
          role?: string
          suggested_lagrum?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_verdict_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_verdict_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "review_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          bank_id: string
          category: string
          created_at: string | null
          document_url: string | null
          id: string
          last_reviewed: string | null
          name: string
          next_review: string | null
          owner: string | null
          src_reference: string | null
          status: string
          version: string | null
        }
        Insert: {
          bank_id: string
          category: string
          created_at?: string | null
          document_url?: string | null
          id?: string
          last_reviewed?: string | null
          name: string
          next_review?: string | null
          owner?: string | null
          src_reference?: string | null
          status?: string
          version?: string | null
        }
        Update: {
          bank_id?: string
          category?: string
          created_at?: string | null
          document_url?: string | null
          id?: string
          last_reviewed?: string | null
          name?: string
          next_review?: string | null
          owner?: string | null
          src_reference?: string | null
          status?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      regulatory_changes: {
        Row: {
          bank_id: string | null
          created_at: string | null
          effective_date: string | null
          id: string
          impact_summary: string | null
          source_reference: string | null
          source_type: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          bank_id?: string | null
          created_at?: string | null
          effective_date?: string | null
          id?: string
          impact_summary?: string | null
          source_reference?: string | null
          source_type?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          bank_id?: string | null
          created_at?: string | null
          effective_date?: string | null
          id?: string
          impact_summary?: string | null
          source_reference?: string | null
          source_type?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_changes_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_policy_links: {
        Row: {
          created_at: string | null
          id: string
          impact_description: string | null
          impact_level: string | null
          policy_id: string | null
          regulatory_change_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          impact_description?: string | null
          impact_level?: string | null
          policy_id?: string | null
          regulatory_change_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          impact_description?: string | null
          impact_level?: string | null
          policy_id?: string | null
          regulatory_change_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_policy_links_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_policy_links_regulatory_change_id_fkey"
            columns: ["regulatory_change_id"]
            isOneToOne: false
            referencedRelation: "regulatory_changes"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement: {
        Row: {
          åtgärder: Json | null
          beskrivning: string | null
          created_at: string | null
          created_by: string | null
          id: number
          lagrum: string | null
          legal_source_id: number
          obligation: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_confidence: number | null
          reviewer_flags: string[] | null
          risknivå: string | null
          status: string
          subjekt: string[] | null
          titel: string
          trigger: string[] | null
          undantag: string[] | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          åtgärder?: Json | null
          beskrivning?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: number
          lagrum?: string | null
          legal_source_id: number
          obligation: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_confidence?: number | null
          reviewer_flags?: string[] | null
          risknivå?: string | null
          status?: string
          subjekt?: string[] | null
          titel: string
          trigger?: string[] | null
          undantag?: string[] | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          åtgärder?: Json | null
          beskrivning?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: number
          lagrum?: string | null
          legal_source_id?: number
          obligation?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_confidence?: number | null
          reviewer_flags?: string[] | null
          risknivå?: string | null
          status?: string
          subjekt?: string[] | null
          titel?: string
          trigger?: string[] | null
          undantag?: string[] | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requirement_legal_source_id_fkey"
            columns: ["legal_source_id"]
            isOneToOne: false
            referencedRelation: "legal_source"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_member: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_member_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      review_queue: {
        Row: {
          beskrivning: string | null
          created_at: string | null
          id: number | null
          lagrum: string | null
          legal_source_id: number | null
          obligation: string | null
          referens: string | null
          regelverk_name: string | null
          reviewer_confidence: number | null
          reviewer_flags: string[] | null
          risknivå: string | null
          source_full_text: string | null
          subjekt: string[] | null
          titel: string | null
          trigger: string[] | null
          undantag: string[] | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requirement_legal_source_id_fkey"
            columns: ["legal_source_id"]
            isOneToOne: false
            referencedRelation: "legal_source"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_member: { Args: { _workspace_id: string }; Returns: boolean }
      match_legal_sources: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          full_text: string
          id: number
          lagrum: string
          similarity: number
        }[]
      }
      user_can_access_workspace: {
        Args: { _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
