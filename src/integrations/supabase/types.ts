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
      admin_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string
          created_at: string
          details: Json | null
          id: string
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          charged_credits: number
          charged_usd: number
          created_at: string
          error: string | null
          feature: string
          id: string
          input_tokens: number
          metadata: Json
          model: string
          output_tokens: number
          profit_usd: number
          provider_cost_usd: number
          status: string
          user_id: string
        }
        Insert: {
          charged_credits?: number
          charged_usd?: number
          created_at?: string
          error?: string | null
          feature: string
          id?: string
          input_tokens?: number
          metadata?: Json
          model: string
          output_tokens?: number
          profit_usd?: number
          provider_cost_usd?: number
          status?: string
          user_id: string
        }
        Update: {
          charged_credits?: number
          charged_usd?: number
          created_at?: string
          error?: string | null
          feature?: string
          id?: string
          input_tokens?: number
          metadata?: Json
          model?: string
          output_tokens?: number
          profit_usd?: number
          provider_cost_usd?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      cast_personas: {
        Row: {
          accent: string
          age_range: string
          color: string
          created_at: string
          description: string
          gender: string
          id: string
          name: string
          sample_line: string
          tone_tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          accent?: string
          age_range?: string
          color?: string
          created_at?: string
          description?: string
          gender?: string
          id?: string
          name: string
          sample_line?: string
          tone_tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          accent?: string
          age_range?: string
          color?: string
          created_at?: string
          description?: string
          gender?: string
          id?: string
          name?: string
          sample_line?: string
          tone_tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          actor_user_id: string | null
          ai_usage_id: string | null
          balance_after: number
          created_at: string
          credits_delta: number
          id: string
          note: string | null
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          type: Database["public"]["Enums"]["credit_txn_type"]
          usd_amount: number | null
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          ai_usage_id?: string | null
          balance_after: number
          created_at?: string
          credits_delta: number
          id?: string
          note?: string | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          type: Database["public"]["Enums"]["credit_txn_type"]
          usd_amount?: number | null
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          ai_usage_id?: string | null
          balance_after?: number
          created_at?: string
          credits_delta?: number
          id?: string
          note?: string | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          type?: Database["public"]["Enums"]["credit_txn_type"]
          usd_amount?: number | null
          user_id?: string
        }
        Relationships: []
      }
      document_folders: {
        Row: {
          color: string
          created_at: string
          device_id: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          device_id: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          device_id?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          archived: boolean
          caption: string | null
          created_at: string
          deleted_at: string | null
          device_id: string
          file_name: string
          folder_id: string | null
          id: string
          mime_type: string
          pinned: boolean
          size_bytes: number
          storage_path: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          archived?: boolean
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          device_id: string
          file_name: string
          folder_id?: string | null
          id?: string
          mime_type?: string
          pinned?: boolean
          size_bytes?: number
          storage_path: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          archived?: boolean
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          device_id?: string
          file_name?: string
          folder_id?: string | null
          id?: string
          mime_type?: string
          pinned?: boolean
          size_bytes?: number
          storage_path?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_publications: {
        Row: {
          created_at: string
          description: string | null
          error: string | null
          host: string
          id: string
          payload: Json
          remote_episode_id: string | null
          remote_url: string | null
          script_note_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          voice_memo_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          error?: string | null
          host: string
          id?: string
          payload?: Json
          remote_episode_id?: string | null
          remote_url?: string | null
          script_note_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          voice_memo_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          error?: string | null
          host?: string
          id?: string
          payload?: Json
          remote_episode_id?: string | null
          remote_url?: string | null
          script_note_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          voice_memo_id?: string | null
        }
        Relationships: []
      }
      folders: {
        Row: {
          color: string
          created_at: string
          device_id: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          device_id: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          device_id?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      note_attachments: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          mime_type: string | null
          note_id: string
          prompt: string | null
          size_bytes: number
          source: string
          storage_path: string | null
          url: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          note_id: string
          prompt?: string | null
          size_bytes?: number
          source?: string
          storage_path?: string | null
          url: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          note_id?: string
          prompt?: string | null
          size_bytes?: number
          source?: string
          storage_path?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_attachments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_links: {
        Row: {
          created_at: string
          favicon: string | null
          id: string
          note_id: string
          title: string | null
          url: string
        }
        Insert: {
          created_at?: string
          favicon?: string | null
          id?: string
          note_id: string
          title?: string | null
          url: string
        }
        Update: {
          created_at?: string
          favicon?: string | null
          id?: string
          note_id?: string
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_links_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          archived: boolean
          category: string | null
          created_at: string
          deleted_at: string | null
          device_id: string
          done: boolean
          fired: boolean
          folder_id: string | null
          id: string
          locked: boolean
          mode: string
          notify_lead_minutes: number | null
          pinned: boolean
          priority: Database["public"]["Enums"]["task_priority"]
          remind_at: string | null
          subtasks: Json
          tags: string[]
          text: string
          title: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          device_id: string
          done?: boolean
          fired?: boolean
          folder_id?: string | null
          id?: string
          locked?: boolean
          mode?: string
          notify_lead_minutes?: number | null
          pinned?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          remind_at?: string | null
          subtasks?: Json
          tags?: string[]
          text?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          device_id?: string
          done?: boolean
          fired?: boolean
          folder_id?: string | null
          id?: string
          locked?: boolean
          mode?: string
          notify_lead_minutes?: number | null
          pinned?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          remind_at?: string | null
          subtasks?: Json
          tags?: string[]
          text?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_settings: {
        Row: {
          api_key: string | null
          created_at: string
          default_author: string | null
          default_author_email: string | null
          default_explicit: boolean
          host: string
          id: string
          show_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          default_author?: string | null
          default_author_email?: string | null
          default_explicit?: boolean
          host?: string
          id?: string
          show_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          default_author?: string | null
          default_author_email?: string | null
          default_explicit?: boolean
          host?: string
          id?: string
          show_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          pin_hash: string | null
          pin_length: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          pin_hash?: string | null
          pin_length?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          pin_hash?: string | null
          pin_length?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_dispatch_log: {
        Row: {
          fired_at: string
          kind: string
          note_id: string
        }
        Insert: {
          fired_at?: string
          kind: string
          note_id: string
        }
        Update: {
          fired_at?: string
          kind?: string
          note_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_id: string
          enabled: boolean
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          strong_alerts: boolean
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          device_id: string
          enabled?: boolean
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          strong_alerts?: boolean
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          device_id?: string
          enabled?: boolean
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          strong_alerts?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      script_cast: {
        Row: {
          created_at: string
          id: string
          persona_id: string
          speaker_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          persona_id: string
          speaker_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          persona_id?: string
          speaker_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_cast_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "cast_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_checkout_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          credits: number
          id: string
          payment_intent: string | null
          status: string
          usd_amount: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          credits: number
          id: string
          payment_intent?: string | null
          status?: string
          usd_amount: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          credits?: number
          id?: string
          payment_intent?: string | null
          status?: string
          usd_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      support_ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_comments: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          author_role?: string
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          app_version: string | null
          assigned_to: string | null
          created_at: string
          description: string
          diagnostics: Json
          id: string
          last_activity_at: string
          page_url: string | null
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          ticket_number: string
          updated_at: string
          user_agent: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          assigned_to?: string | null
          created_at?: string
          description: string
          diagnostics?: Json
          id?: string
          last_activity_at?: string
          page_url?: string | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          ticket_number?: string
          updated_at?: string
          user_agent?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string
          diagnostics?: Json
          id?: string
          last_activity_at?: string
          page_url?: string | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          ticket_number?: string
          updated_at?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_wallets: {
        Row: {
          balance_credits: number
          blocked: boolean
          blocked_reason: string | null
          created_at: string
          lifetime_granted_credits: number
          lifetime_purchased_credits: number
          lifetime_spent_credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_credits?: number
          blocked?: boolean
          blocked_reason?: string | null
          created_at?: string
          lifetime_granted_credits?: number
          lifetime_purchased_credits?: number
          lifetime_spent_credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_credits?: number
          blocked?: boolean
          blocked_reason?: string | null
          created_at?: string
          lifetime_granted_credits?: number
          lifetime_purchased_credits?: number
          lifetime_spent_credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_memos: {
        Row: {
          created_at: string
          device_id: string
          duration_seconds: number
          id: string
          mime_type: string
          note_id: string | null
          size_bytes: number
          storage_path: string
          title: string
          transcript: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          device_id: string
          duration_seconds?: number
          id?: string
          mime_type?: string
          note_id?: string | null
          size_bytes?: number
          storage_path: string
          title?: string
          transcript?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          device_id?: string
          duration_seconds?: number
          id?: string
          mime_type?: string
          note_id?: string | null
          size_bytes?: number
          storage_path?: string
          title?: string
          transcript?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      charge_credits: {
        Args: {
          _ai_usage_id: string
          _credits: number
          _note: string
          _usd_amount: number
          _user_id: string
        }
        Returns: number
      }
      credit_wallet: {
        Args: {
          _actor_user_id: string
          _credits: number
          _note: string
          _stripe_payment_intent: string
          _stripe_session_id: string
          _type: Database["public"]["Enums"]["credit_txn_type"]
          _usd_amount: number
          _user_id: string
        }
        Returns: number
      }
      generate_support_ticket_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      credit_txn_type: "purchase" | "usage" | "grant" | "refund" | "reversal"
      support_ticket_priority: "low" | "normal" | "high" | "urgent"
      support_ticket_status: "open" | "in_progress" | "resolved" | "closed"
      task_priority: "low" | "medium" | "high"
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
      credit_txn_type: ["purchase", "usage", "grant", "refund", "reversal"],
      support_ticket_priority: ["low", "normal", "high", "urgent"],
      support_ticket_status: ["open", "in_progress", "resolved", "closed"],
      task_priority: ["low", "medium", "high"],
    },
  },
} as const
