// Hand-written to match supabase/migrations/0001_init.sql. If the schema
// changes, update this alongside the migration — there's no live project to
// generate it from yet (`supabase gen types typescript` once one exists).

export type Tier = "starter" | "plus" | "advanced";
export type SignalType = "pricing" | "job_posting" | "review" | "news" | "funding" | "seo";
export type SeoTrafficTrend = "up" | "down" | "flat" | "unknown";
export type RelevanceLevel = "High" | "Medium" | "Low";
export type SignalSource = "manual" | "pipeline" | "backfill";
export type IntegrationProvider = "slack" | "email" | "hubspot" | "salesforce" | "intercom" | "gong" | "zoom";
export type ProfileRole = "member" | "admin";
export type BillingModel = "subscription" | "per_seat" | "usage_based" | "custom" | "unknown";
export type SuggestedCompetitorStatus = "pending" | "dismissed" | "added";
export type WinLossOutcome = "won" | "lost";

export type PricingTier = {
  name: string;
  price: number | null;
  price_period: string | null; // e.g. "mo", "seat/mo", "yr"
  features: string[];
};

export type WinLossTrendRelatedSignal = {
  signalId: string;
  relationNote: string;
};

export interface Database {
  public: {
    Tables: {
      waitlist_signups: {
        Row: {
          id: string;
          email: string;
          company_name: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          company_name?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["waitlist_signups"]["Insert"]>;
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          name: string;
          positioning: string | null;
          icp: string | null;
          has_sales_crm: boolean;
          has_plg: boolean;
          lost_deal_notes: string | null;
          won_deal_notes: string | null;
          churn_notes: string | null;
          tier: Tier;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          contact_email: string | null;
          created_by: string | null;
          payment_reminder_1_sent_at: string | null;
          payment_reminder_2_sent_at: string | null;
          cost_alert_sent_month: string | null;
          company_research: string | null;
          company_research_updated_at: string | null;
          weekly_verdict: string | null;
          weekly_verdict_generated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          positioning?: string | null;
          icp?: string | null;
          has_sales_crm?: boolean;
          has_plg?: boolean;
          lost_deal_notes?: string | null;
          won_deal_notes?: string | null;
          churn_notes?: string | null;
          tier?: Tier;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          contact_email?: string | null;
          created_by?: string | null;
          payment_reminder_1_sent_at?: string | null;
          payment_reminder_2_sent_at?: string | null;
          cost_alert_sent_month?: string | null;
          company_research?: string | null;
          company_research_updated_at?: string | null;
          weekly_verdict?: string | null;
          weekly_verdict_generated_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["accounts"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          account_id: string | null;
          role: ProfileRole;
          created_at: string;
        };
        Insert: {
          id: string;
          account_id?: string | null;
          role?: ProfileRole;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      competitors: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          domain: string | null;
          category: string | null;
          pricing_url: string | null;
          careers_url: string | null;
          fact_sheet_why_we_win: string | null;
          fact_sheet_why_we_lose: string | null;
          fact_sheet_generated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          domain?: string | null;
          category?: string | null;
          pricing_url?: string | null;
          careers_url?: string | null;
          fact_sheet_why_we_win?: string | null;
          fact_sheet_why_we_lose?: string | null;
          fact_sheet_generated_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitors"]["Insert"]>;
        Relationships: [];
      };
      competitor_win_loss: {
        Row: {
          id: string;
          competitor_id: string;
          outcome: WinLossOutcome;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          outcome: WinLossOutcome;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitor_win_loss"]["Insert"]>;
        Relationships: [];
      };
      win_loss_trends: {
        Row: {
          id: string;
          account_id: string;
          theme: string;
          summary: string;
          won_count: number;
          lost_count: number;
          example_reasons: string[];
          related_signals: WinLossTrendRelatedSignal[];
          generated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          theme: string;
          summary: string;
          won_count?: number;
          lost_count?: number;
          example_reasons?: string[];
          related_signals?: WinLossTrendRelatedSignal[];
          generated_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["win_loss_trends"]["Insert"]>;
        Relationships: [];
      };
      api_keys: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          key_hash: string;
          key_prefix: string;
          created_by: string | null;
          last_used_at: string | null;
          revoked_at: string | null;
          rate_limit_window_started_at: string | null;
          rate_limit_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name?: string;
          key_hash: string;
          key_prefix: string;
          created_by?: string | null;
          last_used_at?: string | null;
          revoked_at?: string | null;
          rate_limit_window_started_at?: string | null;
          rate_limit_count?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["api_keys"]["Insert"]>;
        Relationships: [];
      };
      suggested_competitors: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          domain: string | null;
          category: string | null;
          reasoning: string | null;
          status: SuggestedCompetitorStatus;
          discovered_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          domain?: string | null;
          category?: string | null;
          reasoning?: string | null;
          status?: SuggestedCompetitorStatus;
          discovered_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["suggested_competitors"]["Insert"]>;
        Relationships: [];
      };
      signals: {
        Row: {
          id: string;
          competitor_id: string;
          type: SignalType;
          title: string;
          summary: string | null;
          url: string | null;
          occurred_on: string;
          scored: boolean;
          relevance_level: RelevanceLevel | null;
          relevance_score: number | null;
          relevance_reasoning: string | null;
          scoring_version: string | null;
          source: SignalSource;
          slack_sent_at: string | null;
          email_digest_sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          type: SignalType;
          title: string;
          summary?: string | null;
          url?: string | null;
          occurred_on?: string;
          scored?: boolean;
          relevance_level?: RelevanceLevel | null;
          relevance_score?: number | null;
          relevance_reasoning?: string | null;
          scoring_version?: string | null;
          source?: SignalSource;
          slack_sent_at?: string | null;
          email_digest_sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["signals"]["Insert"]>;
        Relationships: [];
      };
      integrations: {
        Row: {
          id: string;
          account_id: string;
          provider: IntegrationProvider;
          connected: boolean;
          connected_at: string | null;
          credentials: Record<string, unknown> | null;
          external_account_id: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          provider: IntegrationProvider;
          connected?: boolean;
          connected_at?: string | null;
          credentials?: Record<string, unknown> | null;
          external_account_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["integrations"]["Insert"]>;
        Relationships: [];
      };
      page_snapshots: {
        Row: {
          id: string;
          competitor_id: string;
          kind: "pricing" | "jobs" | "producthunt" | "websearch";
          content_hash: string;
          raw_text: string | null;
          captured_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          kind: "pricing" | "jobs" | "producthunt" | "websearch";
          content_hash: string;
          raw_text?: string | null;
          captured_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["page_snapshots"]["Insert"]>;
        Relationships: [];
      };
      competitor_seo: {
        Row: {
          id: string;
          competitor_id: string;
          organic_traffic_estimate: number | null;
          traffic_trend: SeoTrafficTrend | null;
          top_keywords: string[];
          note: string | null;
          last_checked_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          organic_traffic_estimate?: number | null;
          traffic_trend?: SeoTrafficTrend | null;
          top_keywords?: string[];
          note?: string | null;
          last_checked_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitor_seo"]["Insert"]>;
        Relationships: [];
      };
      competitor_pricing: {
        Row: {
          id: string;
          competitor_id: string;
          billing_model: BillingModel;
          publicly_priced: boolean;
          note: string | null;
          tiers: PricingTier[];
          last_checked_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          billing_model?: BillingModel;
          publicly_priced?: boolean;
          note?: string | null;
          tiers?: PricingTier[];
          last_checked_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitor_pricing"]["Insert"]>;
        Relationships: [];
      };
      account_documents: {
        Row: {
          id: string;
          account_id: string | null;
          uploaded_by: string;
          file_name: string;
          storage_path: string;
          size_bytes: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id?: string | null;
          uploaded_by: string;
          file_name: string;
          storage_path: string;
          size_bytes?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["account_documents"]["Insert"]>;
        Relationships: [];
      };
      invites: {
        Row: {
          id: string;
          account_id: string;
          email: string;
          role: ProfileRole;
          token: string;
          invited_by: string | null;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          email: string;
          role?: ProfileRole;
          token?: string;
          invited_by?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["invites"]["Insert"]>;
        Relationships: [];
      };
      career_applications: {
        Row: {
          id: string;
          name: string;
          email: string;
          job_title: string;
          resume_file_name: string;
          resume_storage_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          job_title: string;
          resume_file_name: string;
          resume_storage_path: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["career_applications"]["Insert"]>;
        Relationships: [];
      };
      email_campaigns: {
        Row: {
          id: string;
          name: string;
          segment: string;
          subject: string;
          body: string;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          segment: string;
          subject: string;
          body: string;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_campaigns"]["Insert"]>;
        Relationships: [];
      };
      email_campaign_recipients: {
        Row: {
          id: string;
          campaign_id: string;
          email: string;
          resend_message_id: string | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          email: string;
          resend_message_id?: string | null;
          sent_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_campaign_recipients"]["Insert"]>;
        Relationships: [];
      };
      system_health: {
        Row: {
          id: string;
          last_status: "up" | "down";
          updated_at: string;
        };
        Insert: {
          id: string;
          last_status: "up" | "down";
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_health"]["Insert"]>;
        Relationships: [];
      };
      llm_usage: {
        Row: {
          id: string;
          account_id: string | null;
          function_name: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          cache_creation_tokens: number;
          cache_read_tokens: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id?: string | null;
          function_name: string;
          model: string;
          input_tokens?: number;
          output_tokens?: number;
          cache_creation_tokens?: number;
          cache_read_tokens?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["llm_usage"]["Insert"]>;
        Relationships: [];
      };
      system_alerts: {
        Row: {
          key: string;
          last_sent_at: string;
        };
        Insert: {
          key: string;
          last_sent_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_alerts"]["Insert"]>;
        Relationships: [];
      };
      admin_impersonation_log: {
        Row: {
          id: string;
          admin_id: string;
          admin_email: string;
          target_account_id: string;
          target_account_name: string | null;
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          admin_id: string;
          admin_email: string;
          target_account_id: string;
          target_account_name?: string | null;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["admin_impersonation_log"]["Insert"]>;
        Relationships: [];
      };
      blog_posts: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string;
          published_at: string;
          body: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description: string;
          published_at?: string;
          body: unknown;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blog_posts"]["Insert"]>;
        Relationships: [];
      };
      promo_campaigns: {
        Row: {
          id: string;
          active: boolean;
          percent_off: number;
          duration_months: number;
          code: string;
          banner_text: string;
          link_url: string;
          stripe_coupon_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          active?: boolean;
          percent_off: number;
          duration_months: number;
          code: string;
          banner_text: string;
          link_url?: string;
          stripe_coupon_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["promo_campaigns"]["Insert"]>;
        Relationships: [];
      };
      signal_eval_labels: {
        Row: {
          signal_id: string;
          label: "correct" | "incorrect";
          note: string | null;
          labeled_by: string | null;
          created_at: string;
        };
        Insert: {
          signal_id: string;
          label: "correct" | "incorrect";
          note?: string | null;
          labeled_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["signal_eval_labels"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
