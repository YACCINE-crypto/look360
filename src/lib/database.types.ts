export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      produits: {
        Row: {
          angle_marketing: string | null
          cout_livre_estime: number | null
          created_at: string
          date_a_travailler: string | null
          date_debut_pub_concurrent: string | null
          date_lancement_testing: string | null
          emotion_tag: string | null
          frais_logistiques_kilo: number | null
          id: string
          image_url: string | null
          lien_ad_library: string | null
          lien_concurrent: string | null
          lien_source: string | null
          marche: string | null
          nom: string | null
          notes: string | null
          notif_envoyee: boolean
          poids_kg: number | null
          prix_sourcing: number | null
          soumis_par: string | null
          statut: string
          statut_revue: string
        }
        Insert: {
          angle_marketing?: string | null
          cout_livre_estime?: number | null
          created_at?: string
          date_a_travailler?: string | null
          date_debut_pub_concurrent?: string | null
          date_lancement_testing?: string | null
          emotion_tag?: string | null
          frais_logistiques_kilo?: number | null
          id?: string
          image_url?: string | null
          lien_ad_library?: string | null
          lien_concurrent?: string | null
          lien_source?: string | null
          marche?: string | null
          nom?: string | null
          notes?: string | null
          notif_envoyee?: boolean
          poids_kg?: number | null
          prix_sourcing?: number | null
          soumis_par?: string | null
          statut?: string
          statut_revue?: string
        }
        Update: {
          angle_marketing?: string | null
          cout_livre_estime?: number | null
          created_at?: string
          date_a_travailler?: string | null
          date_debut_pub_concurrent?: string | null
          date_lancement_testing?: string | null
          emotion_tag?: string | null
          frais_logistiques_kilo?: number | null
          id?: string
          image_url?: string | null
          lien_ad_library?: string | null
          lien_concurrent?: string | null
          lien_source?: string | null
          marche?: string | null
          nom?: string | null
          notes?: string | null
          notif_envoyee?: boolean
          poids_kg?: number | null
          prix_sourcing?: number | null
          soumis_par?: string | null
          statut?: string
          statut_revue?: string
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
        }
        Insert: {
          id: string
          nom?: string | null
          role?: string
        }
        Update: {
          id?: string
          nom?: string | null
          role?: string
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
    }
    Views: { [_ in never]: never }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
