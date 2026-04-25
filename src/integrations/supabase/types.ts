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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      campaign_items: {
        Row: {
          ai_category: string | null
          ai_cost_tokens: number | null
          ai_description: string | null
          ai_specs: Json | null
          ai_tags: string[] | null
          campaign_id: string
          created_at: string
          id: string
          image_urls: string[] | null
          original_description: string | null
          price: number
          product_name: string
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          ai_category?: string | null
          ai_cost_tokens?: number | null
          ai_description?: string | null
          ai_specs?: Json | null
          ai_tags?: string[] | null
          campaign_id: string
          created_at?: string
          id?: string
          image_urls?: string[] | null
          original_description?: string | null
          price?: number
          product_name: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Update: {
          ai_category?: string | null
          ai_cost_tokens?: number | null
          ai_description?: string | null
          ai_specs?: Json | null
          ai_tags?: string[] | null
          campaign_id?: string
          created_at?: string
          id?: string
          image_urls?: string[] | null
          original_description?: string | null
          price?: number
          product_name?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_templates: {
        Row: {
          company_id: string | null
          created_at: string
          description_prompt: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description_prompt: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description_prompt?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          items_processed: number
          name: string
          published_at: string | null
          scheduled_at: string | null
          status: string
          template_id: string | null
          total_items: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          items_processed?: number
          name: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          template_id?: string | null
          total_items?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          items_processed?: number
          name?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          template_id?: string | null
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "campaign_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          is_courtesy: boolean
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          plan_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_courtesy?: boolean
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          plan_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_courtesy?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          plan_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_audit_log: {
        Row: {
          action: string
          company_id: string
          created_at: string
          details: Json | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["company_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["company_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["company_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      conference_items: {
        Row: {
          atualizado_por: string | null
          conference_id: string
          created_at: string
          detalhes_caixa: Json | null
          ean: string | null
          expected_quantity: number
          id: string
          invoice_item_id: string | null
          nome_produto: string | null
          product_id: string | null
          scanned_quantity: number
          sku: string | null
          status: string
          tipo_contagem: string
          updated_at: string
        }
        Insert: {
          atualizado_por?: string | null
          conference_id: string
          created_at?: string
          detalhes_caixa?: Json | null
          ean?: string | null
          expected_quantity?: number
          id?: string
          invoice_item_id?: string | null
          nome_produto?: string | null
          product_id?: string | null
          scanned_quantity?: number
          sku?: string | null
          status?: string
          tipo_contagem?: string
          updated_at?: string
        }
        Update: {
          atualizado_por?: string | null
          conference_id?: string
          created_at?: string
          detalhes_caixa?: Json | null
          ean?: string | null
          expected_quantity?: number
          id?: string
          invoice_item_id?: string | null
          nome_produto?: string | null
          product_id?: string | null
          scanned_quantity?: number
          sku?: string | null
          status?: string
          tipo_contagem?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conference_items_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conference_items_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conference_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conference_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
        ]
      }
      conferences: {
        Row: {
          atualizado_por: string | null
          company_id: string | null
          created_at: string
          criado_por: string | null
          finished_at: string | null
          id: string
          invoice_id: string | null
          nome: string | null
          notes: string | null
          section_name: string | null
          started_at: string
          status: string
          tipo: string
          type: string | null
          updated_at: string
        }
        Insert: {
          atualizado_por?: string | null
          company_id?: string | null
          created_at?: string
          criado_por?: string | null
          finished_at?: string | null
          id?: string
          invoice_id?: string | null
          nome?: string | null
          notes?: string | null
          section_name?: string | null
          started_at?: string
          status?: string
          tipo?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          atualizado_por?: string | null
          company_id?: string | null
          created_at?: string
          criado_por?: string | null
          finished_at?: string | null
          id?: string
          invoice_id?: string | null
          nome?: string | null
          notes?: string | null
          section_name?: string | null
          started_at?: string
          status?: string
          tipo?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferences_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          company_id: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      envio_pendente: {
        Row: {
          company_id: string
          created_at: string
          id: string
          ordem_id: string
          product_id: string
          quantidade: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          ordem_id: string
          product_id: string
          quantidade?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          ordem_id?: string
          product_id?: string
          quantidade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "envio_pendente_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_full"
            referencedColumns: ["id"]
          },
        ]
      }
      full_orders: {
        Row: {
          bipagem_state: Json | null
          company_id: string | null
          created_at: string | null
          frete_ml: string | null
          id: string
          pausado_em: string | null
          pdf_frete_id: string | null
          previsao_carregamento: string | null
          separado_em: string | null
          separado_por: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          bipagem_state?: Json | null
          company_id?: string | null
          created_at?: string | null
          frete_ml?: string | null
          id?: string
          pausado_em?: string | null
          pdf_frete_id?: string | null
          previsao_carregamento?: string | null
          separado_em?: string | null
          separado_por?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          bipagem_state?: Json | null
          company_id?: string | null
          created_at?: string | null
          frete_ml?: string | null
          id?: string
          pausado_em?: string | null
          pdf_frete_id?: string | null
          previsao_carregamento?: string | null
          separado_em?: string | null
          separado_por?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "full_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "full_orders_separado_por_profiles_fkey"
            columns: ["separado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gravacoes_full: {
        Row: {
          company_id: string
          created_at: string
          duracao_segundos: number
          envio_id: string | null
          id: string
          storage_path: string
          tamanho_bytes: number
          tipo: string
          url_video: string
          usuario_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          duracao_segundos?: number
          envio_id?: string | null
          id?: string
          storage_path: string
          tamanho_bytes?: number
          tipo: string
          url_video: string
          usuario_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          duracao_segundos?: number
          envio_id?: string | null
          id?: string
          storage_path?: string
          tamanho_bytes?: number
          tipo?: string
          url_video?: string
          usuario_id?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          match_confidence: number | null
          match_type: string
          product_id: string | null
          quantity: number
          stock_updated: boolean
          total_value: number
          unit_value: number
          xml_cfop: string | null
          xml_code: string
          xml_description: string
          xml_ean: string | null
          xml_ncm: string | null
          xml_unit: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          match_confidence?: number | null
          match_type?: string
          product_id?: string | null
          quantity?: number
          stock_updated?: boolean
          total_value?: number
          unit_value?: number
          xml_cfop?: string | null
          xml_code: string
          xml_description: string
          xml_ean?: string | null
          xml_ncm?: string | null
          xml_unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          match_confidence?: number | null
          match_type?: string
          product_id?: string | null
          quantity?: number
          stock_updated?: boolean
          total_value?: number
          unit_value?: number
          xml_cfop?: string | null
          xml_code?: string
          xml_description?: string
          xml_ean?: string | null
          xml_ncm?: string | null
          xml_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string | null
          id: string
          installment_number: number | null
          invoice_id: string
          is_cash: boolean
          notes: string | null
          paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          installment_number?: number | null
          invoice_id: string
          is_cash?: boolean
          notes?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          installment_number?: number | null
          invoice_id?: string
          is_cash?: boolean
          notes?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          imported_at: string
          issuer_cnpj: string | null
          issuer_name: string | null
          items_count: number
          number: string
          series: string | null
          status: string
          total_value: number
          xml_data: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          imported_at?: string
          issuer_cnpj?: string | null
          issuer_name?: string | null
          items_count?: number
          number: string
          series?: string | null
          status?: string
          total_value?: number
          xml_data?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          imported_at?: string
          issuer_cnpj?: string | null
          issuer_name?: string | null
          items_count?: number
          number?: string
          series?: string | null
          status?: string
          total_value?: number
          xml_data?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_items: {
        Row: {
          created_at: string
          id: string
          kit_id: string
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          kit_id: string
          product_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          kit_id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "kit_items_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "product_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_connections: {
        Row: {
          access_token: string
          created_at: string
          id: string
          is_active: boolean
          ml_user_id: string
          refresh_token: string | null
          seller_nickname: string | null
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          is_active?: boolean
          ml_user_id: string
          refresh_token?: string | null
          seller_nickname?: string | null
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          is_active?: boolean
          ml_user_id?: string
          refresh_token?: string | null
          seller_nickname?: string | null
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ml_linked_products: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string | null
          ml_available_quantity: number | null
          ml_item_id: string
          ml_price: number | null
          ml_status: string | null
          ml_title: string | null
          product_id: string
          sync_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          ml_available_quantity?: number | null
          ml_item_id: string
          ml_price?: number | null
          ml_status?: string | null
          ml_title?: string | null
          product_id: string
          sync_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          ml_available_quantity?: number | null
          ml_item_id?: string
          ml_price?: number | null
          ml_status?: string | null
          ml_title?: string | null
          product_id?: string
          sync_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ml_linked_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_linked_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_order_items: {
        Row: {
          created_at: string
          id: string
          ml_item_id: string
          ml_item_title: string | null
          ml_order_id: string
          product_id: string | null
          quantity: number
          sku: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          ml_item_id: string
          ml_item_title?: string | null
          ml_order_id: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          ml_item_id?: string
          ml_item_title?: string | null
          ml_order_id?: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "ml_order_items_ml_order_id_fkey"
            columns: ["ml_order_id"]
            isOneToOne: false
            referencedRelation: "ml_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_orders: {
        Row: {
          company_id: string | null
          created_at: string
          currency_id: string | null
          date_closed: string | null
          date_created: string | null
          id: string
          marketplace_fee: number | null
          ml_buyer_id: number | null
          ml_buyer_nickname: string | null
          ml_order_id: number
          ml_raw: Json | null
          pack_id: number | null
          shipping_cost: number | null
          shipping_id: number | null
          shipping_status: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          currency_id?: string | null
          date_closed?: string | null
          date_created?: string | null
          id?: string
          marketplace_fee?: number | null
          ml_buyer_id?: number | null
          ml_buyer_nickname?: string | null
          ml_order_id: number
          ml_raw?: Json | null
          pack_id?: number | null
          shipping_cost?: number | null
          shipping_id?: number | null
          shipping_status?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          currency_id?: string | null
          date_closed?: string | null
          date_created?: string | null
          id?: string
          marketplace_fee?: number | null
          ml_buyer_id?: number | null
          ml_buyer_nickname?: string | null
          ml_order_id?: number
          ml_raw?: Json | null
          pack_id?: number | null
          shipping_cost?: number | null
          shipping_id?: number | null
          shipping_status?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ml_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_questions: {
        Row: {
          answer_date: string | null
          answer_text: string | null
          company_id: string | null
          created_at: string
          id: string
          ml_from_id: number | null
          ml_from_nickname: string | null
          ml_item_id: string
          ml_item_title: string | null
          ml_question_id: number
          ml_raw: Json | null
          question_date: string | null
          question_text: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer_date?: string | null
          answer_text?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          ml_from_id?: number | null
          ml_from_nickname?: string | null
          ml_item_id: string
          ml_item_title?: string | null
          ml_question_id: number
          ml_raw?: Json | null
          question_date?: string | null
          question_text: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer_date?: string | null
          answer_text?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          ml_from_id?: number | null
          ml_from_nickname?: string | null
          ml_item_id?: string
          ml_item_title?: string | null
          ml_question_id?: number
          ml_raw?: Json | null
          question_date?: string | null
          question_text?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ml_questions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_settings: {
        Row: {
          auto_suggest_answers: boolean
          auto_sync_orders: boolean
          auto_sync_price: boolean
          auto_sync_stock: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_suggest_answers?: boolean
          auto_sync_orders?: boolean
          auto_sync_price?: boolean
          auto_sync_stock?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_suggest_answers?: boolean
          auto_sync_orders?: boolean
          auto_sync_price?: boolean
          auto_sync_stock?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ml_sync_logs: {
        Row: {
          created_at: string
          details: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          items_synced: number | null
          started_at: string
          status: string
          sync_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_synced?: number | null
          started_at?: string
          status?: string
          sync_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_synced?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          user_id?: string
        }
        Relationships: []
      }
      ordens_full: {
        Row: {
          atribuido_para: string | null
          company_id: string
          concluida_em: string | null
          created_at: string
          criado_por: string
          descricao: string | null
          frete_ml: string | null
          gravacao_id: string | null
          id: string
          iniciada_em: string | null
          numero: string
          prazo: string | null
          previsao_carregamento: string | null
          separado_em: string | null
          separado_por: string | null
          status: Database["public"]["Enums"]["ordem_full_status"]
          total_itens: number
          total_itens_separados: number | null
          total_produtos: number
          total_produtos_separados: number | null
          updated_at: string
        }
        Insert: {
          atribuido_para?: string | null
          company_id: string
          concluida_em?: string | null
          created_at?: string
          criado_por: string
          descricao?: string | null
          frete_ml?: string | null
          gravacao_id?: string | null
          id?: string
          iniciada_em?: string | null
          numero?: string
          prazo?: string | null
          previsao_carregamento?: string | null
          separado_em?: string | null
          separado_por?: string | null
          status?: Database["public"]["Enums"]["ordem_full_status"]
          total_itens?: number
          total_itens_separados?: number | null
          total_produtos?: number
          total_produtos_separados?: number | null
          updated_at?: string
        }
        Update: {
          atribuido_para?: string | null
          company_id?: string
          concluida_em?: string | null
          created_at?: string
          criado_por?: string
          descricao?: string | null
          frete_ml?: string | null
          gravacao_id?: string | null
          id?: string
          iniciada_em?: string | null
          numero?: string
          prazo?: string | null
          previsao_carregamento?: string | null
          separado_em?: string | null
          separado_por?: string | null
          status?: Database["public"]["Enums"]["ordem_full_status"]
          total_itens?: number
          total_itens_separados?: number | null
          total_produtos?: number
          total_produtos_separados?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_full_atribuido_para_fkey"
            columns: ["atribuido_para"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_full_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_full_separado_por_profiles_fkey"
            columns: ["separado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_full_itens: {
        Row: {
          created_at: string
          id: string
          ordem_id: string
          product_id: string
          qtd_separada: number
          qtd_solicitada: number
          status: Database["public"]["Enums"]["ordem_item_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordem_id: string
          product_id: string
          qtd_separada?: number
          qtd_solicitada?: number
          status?: Database["public"]["Enums"]["ordem_item_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ordem_id?: string
          product_id?: string
          qtd_separada?: number
          qtd_solicitada?: number
          status?: Database["public"]["Enums"]["ordem_item_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_full_itens_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_full_itens_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_full_itens_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
        ]
      }
      order_recordings: {
        Row: {
          criado_em: string | null
          duracao_segundos: number | null
          id: string
          pedido_id: string
          responsavel_id: string | null
          tipo: string | null
          video_url: string | null
        }
        Insert: {
          criado_em?: string | null
          duracao_segundos?: number | null
          id?: string
          pedido_id: string
          responsavel_id?: string | null
          tipo?: string | null
          video_url?: string | null
        }
        Update: {
          criado_em?: string | null
          duracao_segundos?: number | null
          id?: string
          pedido_id?: string
          responsavel_id?: string | null
          tipo?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_recordings_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_logs: {
        Row: {
          asaas_payment_id: string | null
          company_id: string
          created_at: string
          event_type: string
          id: string
          payment_method: string | null
          raw_data: Json | null
          status: string
          subscription_id: string | null
          value: number | null
        }
        Insert: {
          asaas_payment_id?: string | null
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          payment_method?: string | null
          raw_data?: Json | null
          status: string
          subscription_id?: string | null
          value?: number | null
        }
        Update: {
          asaas_payment_id?: string | null
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payment_method?: string | null
          raw_data?: Json | null
          status?: string
          subscription_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          is_active: boolean
          max_products: number
          max_users: number
          name: string
          price: number
          slug: Database["public"]["Enums"]["plan_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_products?: number
          max_users?: number
          name: string
          price?: number
          slug: Database["public"]["Enums"]["plan_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_products?: number
          max_users?: number
          name?: string
          price?: number
          slug?: Database["public"]["Enums"]["plan_type"]
          updated_at?: string
        }
        Relationships: []
      }
      product_alternative_gtins: {
        Row: {
          company_id: string
          created_at: string
          gtin: string
          id: string
          product_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          gtin: string
          id?: string
          product_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          gtin?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_alternative_gtins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_alternative_gtins_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_alternative_gtins_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
        ]
      }
      product_gtins: {
        Row: {
          company_id: string | null
          created_at: string
          gtin: string
          id: string
          product_id: string
          qtd_por_caixa: number | null
          tipo: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          gtin: string
          id?: string
          product_id: string
          qtd_por_caixa?: number | null
          tipo?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          gtin?: string
          id?: string
          product_id?: string
          qtd_por_caixa?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_gtins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_gtins_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_gtins_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
        ]
      }
      product_kits: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          description: string | null
          ean: string | null
          id: string
          name: string
          price: number
          sku: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          description?: string | null
          ean?: string | null
          id?: string
          name: string
          price?: number
          sku: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          description?: string | null
          ean?: string | null
          id?: string
          name?: string
          price?: number
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_kits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_supplier_skus: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          supplier_cnpj: string | null
          supplier_name: string | null
          supplier_sku: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          supplier_cnpj?: string | null
          supplier_name?: string | null
          supplier_sku?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          supplier_cnpj?: string | null
          supplier_name?: string | null
          supplier_sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_supplier_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_supplier_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
        ]
      }
      product_suppliers: {
        Row: {
          cost: number
          created_at: string
          id: string
          is_primary: boolean
          product_id: string
          supplier_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id: string
          supplier_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_watchlist: {
        Row: {
          avg_cost: number | null
          category: string | null
          company_id: string | null
          created_at: string
          demand_level: string | null
          id: string
          margin_percent: number | null
          notes: string | null
          product_name: string
          suggested_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cost?: number | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          demand_level?: string | null
          id?: string
          margin_percent?: number | null
          notes?: string | null
          product_name: string
          suggested_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cost?: number | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          demand_level?: string | null
          id?: string
          margin_percent?: number | null
          notes?: string | null
          product_name?: string
          suggested_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_watchlist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          barcode: string | null
          box_quantity: number | null
          category_id: string | null
          company_id: string | null
          cost: number
          created_at: string
          depth: number | null
          description: string | null
          ean: string | null
          ean_pending: boolean | null
          gtin_cx: string | null
          height: number | null
          id: string
          id_ml: string | null
          image_url: string | null
          min_stock: number
          name: string
          price: number
          sku: string
          sku_ml: string | null
          stock_full: number
          stock_physical: number
          updated_at: string
          weight: number | null
          width: number | null
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          box_quantity?: number | null
          category_id?: string | null
          company_id?: string | null
          cost?: number
          created_at?: string
          depth?: number | null
          description?: string | null
          ean?: string | null
          ean_pending?: boolean | null
          gtin_cx?: string | null
          height?: number | null
          id?: string
          id_ml?: string | null
          image_url?: string | null
          min_stock?: number
          name: string
          price?: number
          sku: string
          sku_ml?: string | null
          stock_full?: number
          stock_physical?: number
          updated_at?: string
          weight?: number | null
          width?: number | null
        }
        Update: {
          active?: boolean
          barcode?: string | null
          box_quantity?: number | null
          category_id?: string | null
          company_id?: string | null
          cost?: number
          created_at?: string
          depth?: number | null
          description?: string | null
          ean?: string | null
          ean_pending?: boolean | null
          gtin_cx?: string | null
          height?: number | null
          id?: string
          id_ml?: string | null
          image_url?: string | null
          min_stock?: number
          name?: string
          price?: number
          sku?: string
          sku_ml?: string | null
          stock_full?: number
          stock_physical?: number
          updated_at?: string
          weight?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          quantity?: number
          sale_id: string
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string | null
          discount: number
          id: string
          notes: string | null
          payment_method: string
          sale_number: string
          status: string
          total_value: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          payment_method?: string
          sale_number: string
          status?: string
          total_value?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          payment_method?: string
          sale_number?: string
          status?: string
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_stores: {
        Row: {
          banner_url: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          primary_color: string
          sale_mode: Database["public"]["Enums"]["store_sale_mode"]
          slug: string
          store_name: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          banner_url?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          primary_color?: string
          sale_mode?: Database["public"]["Enums"]["store_sale_mode"]
          slug: string
          store_name: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          banner_url?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          primary_color?: string
          sale_mode?: Database["public"]["Enums"]["store_sale_mode"]
          slug?: string
          store_name?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_stores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      store_orders: {
        Row: {
          asaas_bank_slip_url: string | null
          asaas_customer_id: string | null
          asaas_invoice_url: string | null
          asaas_payment_id: string | null
          asaas_pix_copy_paste: string | null
          asaas_pix_qrcode: string | null
          buyer_address: Json | null
          buyer_cpf: string
          buyer_email: string
          buyer_name: string
          buyer_phone: string | null
          created_at: string
          id: string
          order_number: string
          paid_at: string | null
          payment_method:
            | Database["public"]["Enums"]["store_payment_method"]
            | null
          payment_status: Database["public"]["Enums"]["store_payment_status"]
          product_id: string | null
          product_name: string
          quantity: number
          shipping_cost: number
          store_id: string
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          asaas_bank_slip_url?: string | null
          asaas_customer_id?: string | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          asaas_pix_copy_paste?: string | null
          asaas_pix_qrcode?: string | null
          buyer_address?: Json | null
          buyer_cpf: string
          buyer_email: string
          buyer_name: string
          buyer_phone?: string | null
          created_at?: string
          id?: string
          order_number: string
          paid_at?: string | null
          payment_method?:
            | Database["public"]["Enums"]["store_payment_method"]
            | null
          payment_status?: Database["public"]["Enums"]["store_payment_status"]
          product_id?: string | null
          product_name: string
          quantity?: number
          shipping_cost?: number
          store_id: string
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          asaas_bank_slip_url?: string | null
          asaas_customer_id?: string | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          asaas_pix_copy_paste?: string | null
          asaas_pix_qrcode?: string | null
          buyer_address?: Json | null
          buyer_cpf?: string
          buyer_email?: string
          buyer_name?: string
          buyer_phone?: string | null
          created_at?: string
          id?: string
          order_number?: string
          paid_at?: string | null
          payment_method?:
            | Database["public"]["Enums"]["store_payment_method"]
            | null
          payment_status?: Database["public"]["Enums"]["store_payment_status"]
          product_id?: string | null
          product_name?: string
          quantity?: number
          shipping_cost?: number
          store_id?: string
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "seller_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_products: {
        Row: {
          created_at: string
          custom_description: string | null
          custom_price: number | null
          id: string
          is_visible: boolean
          product_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_description?: string | null
          custom_price?: number | null
          id?: string
          is_visible?: boolean
          product_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_description?: string | null
          custom_price?: number | null
          id?: string
          is_visible?: boolean
          product_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "seller_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          billing_type: string | null
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          next_due_date: string | null
          paid_at: string | null
          payment_method: string | null
          plan_id: string
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          billing_type?: string | null
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          next_due_date?: string | null
          paid_at?: string | null
          payment_method?: string | null
          plan_id: string
          status?: string
          updated_at?: string
          value?: number
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          billing_type?: string | null
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          next_due_date?: string | null
          paid_at?: string | null
          payment_method?: string | null
          plan_id?: string
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          cnpj: string | null
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          cnpj?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          cnpj?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transfer_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          transfer_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          transfer_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          transfer_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_items_transfer_order_id_fkey"
            columns: ["transfer_order_id"]
            isOneToOne: false
            referencedRelation: "transfer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_orders: {
        Row: {
          company_id: string | null
          confirmed_at: string | null
          created_at: string
          id: string
          notes: string | null
          order_number: string
          received_at: string | null
          sent_at: string | null
          status: string
          total_items: number
          total_quantity: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_number: string
          received_at?: string | null
          sent_at?: string | null
          status?: string
          total_items?: number
          total_quantity?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_number?: string
          received_at?: string | null
          sent_at?: string | null
          status?: string
          total_items?: number
          total_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
    }
    Views: {
      products_search_view: {
        Row: {
          active: boolean | null
          all_supplier_names: string | null
          all_supplier_skus: string | null
          barcode: string | null
          box_quantity: number | null
          category_id: string | null
          company_id: string | null
          cost: number | null
          created_at: string | null
          depth: number | null
          description: string | null
          ean: string | null
          gtin_cx: string | null
          height: number | null
          id: string | null
          id_ml: string | null
          image_url: string | null
          min_stock: number | null
          name: string | null
          price: number | null
          sku: string | null
          sku_ml: string | null
          stock_full: number | null
          stock_physical: number | null
          updated_at: string | null
          weight: number | null
          width: number | null
        }
        Insert: {
          active?: boolean | null
          all_supplier_names?: never
          all_supplier_skus?: never
          barcode?: string | null
          box_quantity?: number | null
          category_id?: string | null
          company_id?: string | null
          cost?: number | null
          created_at?: string | null
          depth?: number | null
          description?: string | null
          ean?: string | null
          gtin_cx?: string | null
          height?: number | null
          id?: string | null
          id_ml?: string | null
          image_url?: string | null
          min_stock?: number | null
          name?: string | null
          price?: number | null
          sku?: string | null
          sku_ml?: string | null
          stock_full?: number | null
          stock_physical?: number | null
          updated_at?: string | null
          weight?: number | null
          width?: number | null
        }
        Update: {
          active?: boolean | null
          all_supplier_names?: never
          all_supplier_skus?: never
          barcode?: string | null
          box_quantity?: number | null
          category_id?: string | null
          company_id?: string | null
          cost?: number | null
          created_at?: string | null
          depth?: number | null
          description?: string | null
          ean?: string | null
          gtin_cx?: string | null
          height?: number | null
          id?: string | null
          id_ml?: string | null
          image_url?: string | null
          min_stock?: number | null
          name?: string | null
          price?: number | null
          sku?: string | null
          sku_ml?: string | null
          stock_full?: number | null
          stock_physical?: number | null
          updated_at?: string | null
          weight?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      concluir_ordem_full: { Args: { _ordem_id: string }; Returns: undefined }
      dedupe_conference_items: {
        Args: { conf_id: string }
        Returns: {
          kept_rows: number
          removed_rows: number
        }[]
      }
      get_conference_distinct_product_count: {
        Args: { _conference_id: string }
        Returns: number
      }
      get_conference_items_grouped: {
        Args: { conf_id: string }
        Returns: {
          detalhes_caixa: Json
          ean: string
          expected_qty: number
          last_scan: string
          product_id: string
          product_name: string
          sku: string
          total_qty: number
        }[]
      }
      get_conference_totals: {
        Args: { conf_id: string }
        Returns: {
          total_bips: number
          unique_products: number
        }[]
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_owner_or_manager: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      marcar_ordem_enviada: { Args: { _ordem_id: string }; Returns: undefined }
      marcar_ordem_separada: { Args: { _ordem_id: string }; Returns: undefined }
      reset_company_data: { Args: { p_company_id: string }; Returns: undefined }
      search_products_with_suppliers: {
        Args: { p_company_id: string; search_term: string }
        Returns: {
          active: boolean
          barcode: string | null
          box_quantity: number | null
          category_id: string | null
          company_id: string | null
          cost: number
          created_at: string
          depth: number | null
          description: string | null
          ean: string | null
          ean_pending: boolean | null
          gtin_cx: string | null
          height: number | null
          id: string
          id_ml: string | null
          image_url: string | null
          min_stock: number
          name: string
          price: number
          sku: string
          sku_ml: string | null
          stock_full: number
          stock_physical: number
          updated_at: string
          weight: number | null
          width: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      company_role: "owner" | "manager" | "member"
      company_status: "active" | "suspended" | "cancelled"
      ordem_full_status:
        | "rascunho"
        | "aguardando"
        | "em_separacao"
        | "concluida"
        | "cancelada"
        | "separada"
        | "enviada"
      ordem_item_status: "pendente" | "parcial" | "completo" | "excesso"
      plan_type: "free" | "basic" | "premium" | "enterprise"
      store_payment_method: "pix" | "cartao" | "boleto"
      store_payment_status: "pendente" | "pago" | "cancelado" | "expirado"
      store_sale_mode: "mercadolivre" | "proprio" | "hibrido"
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
      app_role: ["admin", "moderator", "user"],
      company_role: ["owner", "manager", "member"],
      company_status: ["active", "suspended", "cancelled"],
      ordem_full_status: [
        "rascunho",
        "aguardando",
        "em_separacao",
        "concluida",
        "cancelada",
        "separada",
        "enviada",
      ],
      ordem_item_status: ["pendente", "parcial", "completo", "excesso"],
      plan_type: ["free", "basic", "premium", "enterprise"],
      store_payment_method: ["pix", "cartao", "boleto"],
      store_payment_status: ["pendente", "pago", "cancelado", "expirado"],
      store_sale_mode: ["mercadolivre", "proprio", "hibrido"],
    },
  },
} as const
