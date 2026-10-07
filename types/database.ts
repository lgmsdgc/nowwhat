// Maintained schema contract. Regenerate with Supabase CLI once a project exists.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
type Table<Row extends Record<string, unknown>, Insert = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};
export type Database = {
  public: {
    Tables: {
      analytics_events: Table<{
        id: string;
        user_id: string;
        anonymous_id: string;
        name: string;
        visit_id: string;
        session_id: string | null;
        recommendation_run_id: string | null;
        mission_id: string | null;
        source: string;
        dedupe_key: string;
        occurred_at: string;
        local_date: string;
        time_zone: string;
        properties: Json;
        received_at: string;
      }>;
      profiles: Table<{
        id: string;
        anonymous_id: string;
        nickname: string | null;
        exp: number;
        level: number;
        revision: number;
        onboarding: Json;
        created_at: string;
        updated_at: string;
        merged_into: string | null;
      }>;
      missions: Table<
        {
          id: string;
          template: Json;
          active: boolean;
          category: string;
          created_at: string;
          title: string;
          short_description: string;
          description: string;
          min_people: number;
          max_people: number | null;
          min_budget: number;
          max_budget: number;
          min_duration: number;
          max_duration: number;
          energy_level: number;
          intensity: number;
          travel_scope: string;
          indoor: boolean;
          outdoor: boolean;
          night_safe: boolean;
          solo_safe: boolean;
          family_safe: boolean;
          minor_safe: boolean;
          requires_car: boolean;
          alcohol_related: boolean;
          physical_risk_level: number;
          physical_intensity: number;
          location_required: boolean;
          base_exp: number;
        },
        { id: string; template: Json }
      >;
      mission_relationships: Table<{
        mission_id: string;
        relationship_type: string;
      }>;
      mission_sessions: Table<{
        id: string;
        user_id: string;
        document: Json;
        mission_id: string;
        status: string;
        position: number;
        awarded_exp: number | null;
        anonymous_id: string;
        recommendation_run_id: string;
        reroll_index: number;
        shown_at: string;
        accepted_at: string | null;
        started_at: string | null;
        completed_at: string | null;
        actual_cost: number | null;
        rating: number | null;
        comment: string | null;
      }>;
      recommendation_feedback: Table<{
        id: string;
        user_id: string;
        document: Json;
        session_id: string;
        mission_id: string;
        action: string;
        position: number;
        anonymous_id: string;
        reason: string | null;
        created_at: string;
      }>;
      achievements: Table<{
        id: string;
        name: string;
        description: string;
        condition_type: string;
        condition_value: Json;
        active: boolean;
        emoji: string;
      }>;
      user_achievements: Table<{
        user_id: string;
        achievement_id: string;
        unlocked_at: string;
        earned_session_id: string | null;
      }>;
      account_migration_tickets: Table<{
        token_hash: string;
        source_user_id: string;
        expires_at: string;
        claimed_by: string | null;
        claimed_at: string | null;
        created_at: string;
      }>;
      local_mission_history: Table<{
        id: string;
        user_id: string;
        source_anonymous_id: string;
        source_session_id: string;
        mission_id: string;
        title: string;
        completed_at: string;
        actual_duration_seconds: number;
        actual_cost: number | null;
        rating: number | null;
        would_do_again: boolean | null;
        comment: string;
        source: "local";
        imported_at: string;
      }>;
    };
    Views: { [_ in never]: never };
    Functions: {
      get_game_state: { Args: Record<string, never>; Returns: Json };
      commit_game_state: {
        Args: {
          p_user_id: string;
          p_expected_revision: number;
          p_state: Json;
          p_analytics_context?: Json;
        };
        Returns: undefined;
      };
      prepare_account_migration: {
        Args: { p_source: string; p_hash: string };
        Returns: undefined;
      };
      claim_account_migration: {
        Args: { p_target: string; p_hash: string };
        Returns: number;
      };
      import_local_history: {
        Args: { p_target: string; p_source: string; p_records: Json };
        Returns: number;
      };
      record_client_events: {
        Args: { p_user_id: string; p_anonymous_id: string; p_events: Json };
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
