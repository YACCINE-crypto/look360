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
      competitors_watch: {
        Row: {
          country: string | null
          created_at: string
          domaine: string | null
          id: string
          known_ad_ids: string[]
          last_checked_at: string | null
          new_ads_count: number
          page_id: string
          page_name: string | null
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          domaine?: string | null
          id?: string
          known_ad_ids?: string[]
          last_checked_at?: string | null
          new_ads_count?: number
          page_id: string
          page_name?: string | null
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          domaine?: string | null
          id?: string
          known_ad_ids?: string[]
          last_checked_at?: string | null
          new_ads_count?: number
          page_id?: string
          page_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitors_watch_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spy_saved_ads: {
        Row: {
          ad_archive_id: string | null
          ad_library_url: string | null
          ad_text: string | null
          created_at: string
          id: string
          is_active: boolean | null
          landing_url: string | null
          media_cdn_url: string | null
          media_source_url: string | null
          media_stored: boolean
          media_type: string | null
          page_id: string | null
          page_name: string | null
          pays_cible: string | null
          platforms: string[] | null
          reach_estimate: number | null
          score: number | null
          start_date: string | null
          thumbnail_cdn_url: string | null
          thumbnail_source_url: string | null
          user_id: string
          variants_count: number | null
        }
        Insert: {
          ad_archive_id?: string | null
          ad_library_url?: string | null
          ad_text?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          landing_url?: string | null
          media_cdn_url?: string | null
          media_source_url?: string | null
          media_stored?: boolean
          media_type?: string | null
          page_id?: string | null
          page_name?: string | null
          pays_cible?: string | null
          platforms?: string[] | null
          reach_estimate?: number | null
          score?: number | null
          start_date?: string | null
          thumbnail_cdn_url?: string | null
          thumbnail_source_url?: string | null
          user_id: string
          variants_count?: number | null
        }
        Update: {
          ad_archive_id?: string | null
          ad_library_url?: string | null
          ad_text?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          landing_url?: string | null
          media_cdn_url?: string | null
          media_source_url?: string | null
          media_stored?: boolean
          media_type?: string | null
          page_id?: string | null
          page_name?: string | null
          pays_cible?: string | null
          platforms?: string[] | null
          reach_estimate?: number | null
          score?: number | null
          start_date?: string | null
          thumbnail_cdn_url?: string | null
          thumbnail_source_url?: string | null
          user_id?: string
          variants_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "spy_saved_ads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spy_searches: {
        Row: {
          cache_key: string
          created_at: string
          filters: Json | null
          id: string
          raw_count: number
          results: Json
          url: string | null
          user_id: string | null
        }
        Insert: {
          cache_key: string
          created_at?: string
          filters?: Json | null
          id?: string
          raw_count?: number
          results?: Json
          url?: string | null
          user_id?: string | null
        }
        Update: {
          cache_key?: string
          created_at?: string
          filters?: Json | null
          id?: string
          raw_count?: number
          results?: Json
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spy_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      produits: {
        Row: {
          angle_marketing: string | null
          categorie: string | null
          cbm: number | null
          cout_livre_estime: number | null
          created_at: string
          date_a_travailler: string | null
          date_debut_pub_concurrent: string | null
          date_lancement_testing: string | null
          emotion_tag: string | null
          frais_logistiques_kilo: number | null
          frais_transit_cbm: number | null
          frais_transit_kilo: number | null
          id: string
          image_url: string | null
          lien_ad_library: string | null
          lien_concurrent: string | null
          lien_source: string | null
          marche: string | null
          media_cdn_url: string | null
          mode_transit: string
          nom: string | null
          notes: string | null
          notif_envoyee: boolean
          poids_kg: number | null
          prix_achat_local: number | null
          prix_fournisseur: number | null
          prix_sourcing: number | null
          soumis_par: string | null
          statut: string
          statut_revue: string
          type_approvisionnement: string
        }
        Insert: {
          angle_marketing?: string | null
          categorie?: string | null
          cbm?: number | null
          cout_livre_estime?: number | null
          created_at?: string
          date_a_travailler?: string | null
          date_debut_pub_concurrent?: string | null
          date_lancement_testing?: string | null
          emotion_tag?: string | null
          frais_logistiques_kilo?: number | null
          frais_transit_cbm?: number | null
          frais_transit_kilo?: number | null
          id?: string
          image_url?: string | null
          lien_ad_library?: string | null
          lien_concurrent?: string | null
          lien_source?: string | null
          marche?: string | null
          media_cdn_url?: string | null
          mode_transit?: string
          nom?: string | null
          notes?: string | null
          notif_envoyee?: boolean
          poids_kg?: number | null
          prix_achat_local?: number | null
          prix_fournisseur?: number | null
          prix_sourcing?: number | null
          soumis_par?: string | null
          statut?: string
          statut_revue?: string
          type_approvisionnement?: string
        }
        Update: {
          angle_marketing?: string | null
          categorie?: string | null
          cbm?: number | null
          cout_livre_estime?: number | null
          created_at?: string
          date_a_travailler?: string | null
          date_debut_pub_concurrent?: string | null
          date_lancement_testing?: string | null
          emotion_tag?: string | null
          frais_logistiques_kilo?: number | null
          frais_transit_cbm?: number | null
          frais_transit_kilo?: number | null
          id?: string
          image_url?: string | null
          lien_ad_library?: string | null
          lien_concurrent?: string | null
          lien_source?: string | null
          marche?: string | null
          media_cdn_url?: string | null
          mode_transit?: string
          nom?: string | null
          notes?: string | null
          notif_envoyee?: boolean
          poids_kg?: number | null
          prix_achat_local?: number | null
          prix_fournisseur?: number | null
          prix_sourcing?: number | null
          soumis_par?: string | null
          statut?: string
          statut_revue?: string
          type_approvisionnement?: string
        }
        Relationships: [
          {
            foreignKeyName: "produits_soumis_par_fkey"
            columns: ["soumis_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          nom: string | null
          role: string
          vitrine_share: boolean
          suspended: boolean
        }
        Insert: {
          id: string
          nom?: string | null
          role?: string
          vitrine_share?: boolean
          suspended?: boolean
        }
        Update: {
          id?: string
          nom?: string | null
          role?: string
          vitrine_share?: boolean
          suspended?: boolean
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys: Json
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      winner_agent_config: {
        Row: {
          active: boolean
          anciennete_min: number
          countries: string[]
          created_at: string
          keywords: string[]
          reach_min: number
          results_max: number
          score_min: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          anciennete_min?: number
          countries?: string[]
          created_at?: string
          keywords?: string[]
          reach_min?: number
          results_max?: number
          score_min?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          anciennete_min?: number
          countries?: string[]
          created_at?: string
          keywords?: string[]
          reach_min?: number
          results_max?: number
          score_min?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      winner_agent_seen: {
        Row: {
          ad_archive_id: string
          id: string
          seen_at: string
          user_id: string
        }
        Insert: {
          ad_archive_id: string
          id?: string
          seen_at?: string
          user_id: string
        }
        Update: {
          ad_archive_id?: string
          id?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      winner_daily: {
        Row: {
          ad_archive_id: string | null
          created_at: string
          day: string
          id: string
          payload: Json
          score: number | null
          user_id: string
        }
        Insert: {
          ad_archive_id?: string | null
          created_at?: string
          day?: string
          id?: string
          payload: Json
          score?: number | null
          user_id: string
        }
        Update: {
          ad_archive_id?: string | null
          created_at?: string
          day?: string
          id?: string
          payload?: Json
          score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      tests: {
        Row: {
          commandes_confirmees: number | null
          commandes_recues: number | null
          cout_produit_estime: number | null
          created_at: string
          depense_pub: number | null
          frais_livraison_prevu: number | null
          id: string
          marche: string | null
          notes_test: string | null
          prix_vente_prevu: number | null
          produit_id: string
          verdict: string | null
        }
        Insert: {
          commandes_confirmees?: number | null
          commandes_recues?: number | null
          cout_produit_estime?: number | null
          created_at?: string
          depense_pub?: number | null
          frais_livraison_prevu?: number | null
          id?: string
          marche?: string | null
          notes_test?: string | null
          prix_vente_prevu?: number | null
          produit_id: string
          verdict?: string | null
        }
        Update: {
          commandes_confirmees?: number | null
          commandes_recues?: number | null
          cout_produit_estime?: number | null
          created_at?: string
          depense_pub?: number | null
          frais_livraison_prevu?: number | null
          id?: string
          marche?: string | null
          notes_test?: string | null
          prix_vente_prevu?: number | null
          produit_id?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tests_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          user_id: string
          plan: string
          status: string
          monthly_credits: number
          pack_credits: number
          credits_balance: number
          current_period_start: string
          current_period_end: string | null
          has_ever_paid: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          plan?: string
          status?: string
          monthly_credits?: number
          pack_credits?: number
          current_period_start?: string
          current_period_end?: string | null
          has_ever_paid?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          plan?: string
          status?: string
          monthly_credits?: number
          pack_credits?: number
          current_period_start?: string
          current_period_end?: string | null
          has_ever_paid?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          id: string
          user_id: string
          type: string
          amount: number
          balance_after: number
          reason: string | null
          reference: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          amount: number
          balance_after: number
          reason?: string | null
          reference?: string | null
          created_at?: string
        }
        Update: {
          reason?: string | null
          reference?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      apply_credits: {
        Args: {
          p_user: string
          p_delta: number
          p_type: string
          p_reason?: string | null
          p_reference?: string | null
        }
        Returns: number
      }
      set_plan: { Args: { p_user: string; p_plan: string }; Returns: number }
      renew_monthly: { Args: { p_user: string }; Returns: number }
      admin_cockpit: { Args: never; Returns: Json }
      admin_charts: { Args: never; Returns: Json }
      admin_activity: { Args: never; Returns: Json }
      admin_revenue: { Args: never; Returns: Json }
      admin_clients: {
        Args: {
          p_search?: string | null
          p_plan?: string | null
          p_status?: string | null
          p_limit?: number
          p_offset?: number
        }
        Returns: Json
      }
      admin_client_detail: { Args: { p_user: string }; Returns: Json }
      admin_grant_credits: {
        Args: { p_user: string; p_amount: number; p_reason?: string }
        Returns: undefined
      }
      admin_set_plan: { Args: { p_user: string; p_plan: string }; Returns: undefined }
      admin_set_suspended: {
        Args: { p_user: string; p_bool: boolean }
        Returns: undefined
      }
      vitrine_winners: {
        Args: never
        Returns: {
          categorie: string
          marche: string
          marge_pct: number
          closing_pct: number
          validated_at: string
        }[]
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
