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
      ad_views: {
        Row: {
          ad_type: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          ad_type: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          ad_type?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      points_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          last_checkin_at: string | null
          last_login_at: string | null
          points: number
          referral_code: string
          referred_by: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          last_checkin_at?: string | null
          last_login_at?: string | null
          points?: number
          referral_code?: string
          referred_by?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_checkin_at?: string | null
          last_login_at?: string | null
          points?: number
          referral_code?: string
          referred_by?: string | null
          username?: string | null
        }
        Relationships: []
      }
      task_starts: {
        Row: {
          started_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          started_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          started_at?: string
          task_id?: string
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
      withdraw_requests: {
        Row: {
          created_at: string
          discord_username: string
          id: string
          status: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          discord_username: string
          id?: string
          status?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          discord_username?: string
          id?: string
          status?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          method: string
          payout_details: string | null
          points_spent: number
          processed_at: string | null
          status: string
          ton_address: string | null
          ton_amount: number
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          method?: string
          payout_details?: string | null
          points_spent: number
          processed_at?: string | null
          status?: string
          ton_address?: string | null
          ton_amount: number
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          method?: string
          payout_details?: string | null
          points_spent?: number
          processed_at?: string | null
          status?: string
          ton_address?: string | null
          ton_amount?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_points: {
        Args: { _delta: number; _reason: string; _target: string }
        Returns: number
      }
      admin_process_withdrawal: {
        Args: { _action: string; _note?: string; _withdrawal_id: string }
        Returns: {
          ok: boolean
          reason: string
        }[]
      }
      claim_ad_reward_atomic: {
        Args: { _ad_type: string; _user_id: string }
        Returns: {
          ok: boolean
          points: number
          reason: string
        }[]
      }
      claim_bonus_reward_atomic: {
        Args: { _user_id: string }
        Returns: {
          ok: boolean
          points: number
          reason: string
        }[]
      }
      claim_daily_checkin: {
        Args: { _amount: number; _user_id: string }
        Returns: {
          claimed: boolean
          next_at: string
          points: number
        }[]
      }
      claim_task_reward_atomic: {
        Args: { _task_id: string; _user_id: string }
        Returns: {
          ok: boolean
          points: number
          reason: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_points: {
        Args: { _delta: number; _user_id: string }
        Returns: number
      }
      request_withdrawal_atomic: {
        Args: {
          _points: number
          _ton_address: string
          _ton_amount: number
          _user_id: string
        }
        Returns: {
          new_points: number
          ok: boolean
          reason: string
        }[]
      }
      request_withdrawal_v2: {
        Args: {
          _amount_units: number
          _method: string
          _payout_details: string
          _user_id: string
        }
        Returns: {
          new_points: number
          ok: boolean
          reason: string
        }[]
      }
      start_task: {
        Args: { _task_id: string; _user_id: string }
        Returns: string
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
