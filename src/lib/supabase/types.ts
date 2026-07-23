// Hand-written to match supabase/migrations/0001_init.sql. If the schema
// changes, update this alongside the migration — there's no live project to
// generate it from yet (`supabase gen types typescript` once one exists).

export type Tier = "starter" | "plus" | "plus_human";
export type SignalType = "pricing" | "job_posting" | "review" | "news" | "funding";
export type RelevanceLevel = "High" | "Medium" | "Low";
export type SignalSource = "manual" | "pipeline";
export type IntegrationProvider = "slack" | "email" | "hubspot" | "salesforce" | "intercom" | "gong" | "zoom";
export type ProfileRole = "member" | "admin";
export type BillingModel = "subscription" | "per_seat" | "usage_based" | "custom" | "unknown";

export type PricingTier = {
  name: string;
  price: number | null;
  price_period: string | null; // e.g. "mo", "seat/mo", "yr"
  features: string[];
};

export interface Database {
  public: {
    Tables: {
      waitlist_signups: {
        Row: {
          id: string;
          email: string;
          company_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          company_name?: string | null;
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
          churn_notes: string | null;
          tier: Tier;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          contact_email: string | null;
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
          churn_notes?: string | null;
          tier?: Tier;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          contact_email?: string | null;
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
          pricing_url: string | null;
          careers_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          domain?: string | null;
          pricing_url?: string | null;
          careers_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitors"]["Insert"]>;
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
          relevance_reasoning: string | null;
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
          relevance_reasoning?: string | null;
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
          kind: "pricing" | "jobs";
          content_hash: string;
          raw_text: string | null;
          captured_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          kind: "pricing" | "jobs";
          content_hash: string;
          raw_text?: string | null;
          captured_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["page_snapshots"]["Insert"]>;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
