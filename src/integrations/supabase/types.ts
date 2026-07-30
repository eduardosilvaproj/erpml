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
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      admin_internal_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          link_to: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link_to?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link_to?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_panel_state: {
        Row: {
          company_id: string | null
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_panel_state_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
          is_test: boolean | null
          logo_url: string | null
          name: string
          owner_id: string | null
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
          is_test?: boolean | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
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
          is_test?: boolean | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "conference_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      full_order_counters: {
        Row: {
          company_id: string
          last_value: number
          updated_at: string | null
        }
        Insert: {
          company_id: string
          last_value?: number
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          last_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "full_order_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      full_order_items: {
        Row: {
          created_at: string | null
          id: string
          kit_id: string | null
          order_id: string
          product_id: string | null
          quantity: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          kit_id?: string | null
          order_id: string
          product_id?: string | null
          quantity?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          kit_id?: string | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "full_order_items_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "product_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "full_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "full_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "full_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "full_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
        ]
      }
      full_orders: {
        Row: {
          bipagem_state: Json | null
          company_id: string | null
          created_at: string | null
          descricao: string | null
          frete_ml: string | null
          id: string
          numero: string | null
          numero_sequencial: number | null
          ordem_id: string | null
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
          descricao?: string | null
          frete_ml?: string | null
          id?: string
          numero?: string | null
          numero_sequencial?: number | null
          ordem_id?: string | null
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
          descricao?: string | null
          frete_ml?: string | null
          id?: string
          numero?: string | null
          numero_sequencial?: number | null
          ordem_id?: string | null
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
      import_job_events: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string
          import_job_id: string
          message: string | null
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          import_job_id: string
          message?: string | null
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          import_job_id?: string
          message?: string | null
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_job_events_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_job_rows: {
        Row: {
          action: string | null
          confidence: number | null
          created_at: string | null
          id: string
          ignored: boolean | null
          import_job_id: string
          mapped_data: Json | null
          match_strategy: string | null
          matched_product_id: string | null
          normalized_data: Json | null
          raw_data: Json | null
          row_index: number
          validation_errors: Json | null
          warnings: Json | null
        }
        Insert: {
          action?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          ignored?: boolean | null
          import_job_id: string
          mapped_data?: Json | null
          match_strategy?: string | null
          matched_product_id?: string | null
          normalized_data?: Json | null
          raw_data?: Json | null
          row_index: number
          validation_errors?: Json | null
          warnings?: Json | null
        }
        Update: {
          action?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          ignored?: boolean | null
          import_job_id?: string
          mapped_data?: Json | null
          match_strategy?: string | null
          matched_product_id?: string | null
          normalized_data?: Json | null
          raw_data?: Json | null
          row_index?: number
          validation_errors?: Json | null
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_job_rows_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          created_products: number | null
          error_rows: number | null
          id: string
          ignored_rows: number | null
          metadata: Json | null
          source_format: string
          source_name: string | null
          source_system: string | null
          status: string
          total_rows: number | null
          type: string
          updated_at: string | null
          updated_products: number | null
          updated_stock_rows: number | null
          valid_rows: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          created_products?: number | null
          error_rows?: number | null
          id?: string
          ignored_rows?: number | null
          metadata?: Json | null
          source_format: string
          source_name?: string | null
          source_system?: string | null
          status?: string
          total_rows?: number | null
          type: string
          updated_at?: string | null
          updated_products?: number | null
          updated_stock_rows?: number | null
          valid_rows?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          created_products?: number | null
          error_rows?: number | null
          id?: string
          ignored_rows?: number | null
          metadata?: Json | null
          source_format?: string
          source_name?: string | null
          source_system?: string | null
          status?: string
          total_rows?: number | null
          type?: string
          updated_at?: string | null
          updated_products?: number | null
          updated_stock_rows?: number | null
          valid_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          supplier_id: string | null
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
          supplier_id?: string | null
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
          supplier_id?: string | null
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
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
          auto_sync_full_orders: boolean | null
          auto_sync_orders: boolean
          auto_sync_price: boolean
          auto_sync_stock: boolean
          created_at: string
          full_sync_interval: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_suggest_answers?: boolean
          auto_sync_full_orders?: boolean | null
          auto_sync_orders?: boolean
          auto_sync_price?: boolean
          auto_sync_stock?: boolean
          created_at?: string
          full_sync_interval?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_suggest_answers?: boolean
          auto_sync_full_orders?: boolean | null
          auto_sync_orders?: boolean
          auto_sync_price?: boolean
          auto_sync_stock?: boolean
          created_at?: string
          full_sync_interval?: string | null
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
      order_recordings: {
        Row: {
          company_id: string | null
          criado_em: string | null
          duracao_segundos: number | null
          id: string
          pedido_id: string
          responsavel_id: string | null
          tipo: string | null
          video_url: string | null
        }
        Insert: {
          company_id?: string | null
          criado_em?: string | null
          duracao_segundos?: number | null
          id?: string
          pedido_id: string
          responsavel_id?: string | null
          tipo?: string | null
          video_url?: string | null
        }
        Update: {
          company_id?: string | null
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
            foreignKeyName: "order_recordings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_recordings_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      panel_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: []
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
          tipo: string
        }
        Insert: {
          company_id: string
          created_at?: string
          gtin: string
          id?: string
          product_id: string
          tipo?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          gtin?: string
          id?: string
          product_id?: string
          tipo?: string
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
          box_quantity: number | null
          company_id: string | null
          created_at: string
          gtin: string
          id: string
          product_id: string
          tipo: string
        }
        Insert: {
          box_quantity?: number | null
          company_id?: string | null
          created_at?: string
          gtin: string
          id?: string
          product_id: string
          tipo?: string
        }
        Update: {
          box_quantity?: number | null
          company_id?: string | null
          created_at?: string
          gtin?: string
          id?: string
          product_id?: string
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
          cost: number | null
          created_at: string
          description: string | null
          ean: string | null
          id: string
          name: string
          price: number
          sku: string
          stock_full: number | null
          stock_min: number | null
          stock_physical: number | null
          stock_reserved: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          ean?: string | null
          id?: string
          name: string
          price?: number
          sku: string
          stock_full?: number | null
          stock_min?: number | null
          stock_physical?: number | null
          stock_reserved?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          ean?: string | null
          id?: string
          name?: string
          price?: number
          sku?: string
          stock_full?: number | null
          stock_min?: number | null
          stock_physical?: number | null
          stock_reserved?: number | null
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
          company_id: string | null
          created_at: string | null
          id: string
          product_id: string
          supplier_cnpj: string | null
          supplier_id: string | null
          supplier_name: string | null
          supplier_sku: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          product_id: string
          supplier_cnpj?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_sku?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          product_id?: string
          supplier_cnpj?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_supplier_skus_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "product_supplier_skus_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
          company_id: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
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
      quarantine_stock: {
        Row: {
          company_id: string
          condition: Database["public"]["Enums"]["item_condition"] | null
          created_at: string
          id: string
          notes: string | null
          product_id: string | null
          quantity: number
          reason: string | null
          released_at: string | null
          released_by: string | null
          released_to: string | null
          return_id: string | null
          return_item_id: string | null
          status: Database["public"]["Enums"]["quarantine_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          condition?: Database["public"]["Enums"]["item_condition"] | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          reason?: string | null
          released_at?: string | null
          released_by?: string | null
          released_to?: string | null
          return_id?: string | null
          return_item_id?: string | null
          status?: Database["public"]["Enums"]["quarantine_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          condition?: Database["public"]["Enums"]["item_condition"] | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          reason?: string | null
          released_at?: string | null
          released_by?: string | null
          released_to?: string | null
          return_id?: string | null
          return_item_id?: string | null
          status?: Database["public"]["Enums"]["quarantine_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quarantine_stock_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quarantine_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quarantine_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quarantine_stock_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quarantine_stock_return_item_id_fkey"
            columns: ["return_item_id"]
            isOneToOne: false
            referencedRelation: "return_items"
            referencedColumns: ["id"]
          },
        ]
      }
      return_actions: {
        Row: {
          action: string
          company_id: string
          created_at: string
          details: Json | null
          id: string
          return_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          details?: Json | null
          id?: string
          return_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          return_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_actions_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      return_evidence: {
        Row: {
          bucket: string
          caption: string | null
          company_id: string
          created_at: string
          id: string
          kind: string
          return_id: string
          return_item_id: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          bucket?: string
          caption?: string | null
          company_id: string
          created_at?: string
          id?: string
          kind?: string
          return_id: string
          return_item_id?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          caption?: string | null
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          return_id?: string
          return_item_id?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_evidence_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_evidence_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_evidence_return_item_id_fkey"
            columns: ["return_item_id"]
            isOneToOne: false
            referencedRelation: "return_items"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          company_id: string
          condition: Database["public"]["Enums"]["item_condition"] | null
          created_at: string
          decision: string | null
          ean: string | null
          expected_quantity: number
          id: string
          nome_produto: string | null
          notes: string | null
          product_id: string | null
          received_quantity: number
          return_id: string
          sku: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          condition?: Database["public"]["Enums"]["item_condition"] | null
          created_at?: string
          decision?: string | null
          ean?: string | null
          expected_quantity?: number
          id?: string
          nome_produto?: string | null
          notes?: string | null
          product_id?: string | null
          received_quantity?: number
          return_id: string
          sku?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          condition?: Database["public"]["Enums"]["item_condition"] | null
          created_at?: string
          decision?: string | null
          ean?: string | null
          expected_quantity?: number
          id?: string
          nome_produto?: string | null
          notes?: string | null
          product_id?: string | null
          received_quantity?: number
          return_id?: string
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          company_id: string
          concluded_at: string | null
          created_at: string
          created_by: string | null
          customer_document: string | null
          customer_name: string | null
          external_id: string | null
          id: string
          motivo: string | null
          notes: string | null
          numero: string
          order_reference: string | null
          received_at: string | null
          responsavel_id: string | null
          source: Database["public"]["Enums"]["return_source"]
          status: Database["public"]["Enums"]["return_status"]
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          company_id: string
          concluded_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_document?: string | null
          customer_name?: string | null
          external_id?: string | null
          id?: string
          motivo?: string | null
          notes?: string | null
          numero: string
          order_reference?: string | null
          received_at?: string | null
          responsavel_id?: string | null
          source?: Database["public"]["Enums"]["return_source"]
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          company_id?: string
          concluded_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_document?: string | null
          customer_name?: string | null
          external_id?: string | null
          id?: string
          motivo?: string | null
          notes?: string | null
          numero?: string
          order_reference?: string | null
          received_at?: string | null
          responsavel_id?: string | null
          source?: Database["public"]["Enums"]["return_source"]
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      stock_movement_logs: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          new_stock: number
          notes: string | null
          old_stock: number
          product_id: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          stock_type: string
          type: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          new_stock: number
          notes?: string | null
          old_stock: number
          product_id?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          stock_type: string
          type: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          new_stock?: number
          notes?: string | null
          old_stock?: number
          product_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          stock_type?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movement_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movement_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movement_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_search_view"
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
      subscription_events: {
        Row: {
          amount: number | null
          company_id: string
          created_at: string
          event_type: string
          external_id: string | null
          id: string
          payload: Json | null
          provider: string
          status: string | null
          subscription_id: string
        }
        Insert: {
          amount?: number | null
          company_id: string
          created_at?: string
          event_type: string
          external_id?: string | null
          id?: string
          payload?: Json | null
          provider: string
          status?: string | null
          subscription_id: string
        }
        Update: {
          amount?: number | null
          company_id?: string
          created_at?: string
          event_type?: string
          external_id?: string | null
          id?: string
          payload?: Json | null
          provider?: string
          status?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_history: {
        Row: {
          actor_id: string | null
          change_type: string
          changed_at: string
          company_id: string
          id: string
          new_plan_id: string
          new_value: number | null
          old_plan_id: string | null
          old_value: number | null
          subscription_id: string
        }
        Insert: {
          actor_id?: string | null
          change_type: string
          changed_at?: string
          company_id: string
          id?: string
          new_plan_id: string
          new_value?: number | null
          old_plan_id?: string | null
          old_value?: number | null
          subscription_id: string
        }
        Update: {
          actor_id?: string | null
          change_type?: string
          changed_at?: string
          company_id?: string
          id?: string
          new_plan_id?: string
          new_value?: number | null
          old_plan_id?: string | null
          old_value?: number | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_history_new_plan_id_fkey"
            columns: ["new_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_history_old_plan_id_fkey"
            columns: ["old_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          subscription_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          subscription_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_notes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
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
          bairro: string | null
          cep: string | null
          cnpj: string | null
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          ie: string | null
          logradouro: string | null
          municipio: string | null
          name: string
          nome_fantasia: string | null
          notes: string | null
          numero: string | null
          origem: string | null
          phone: string | null
          razao_social: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          bairro?: string | null
          cep?: string | null
          cnpj?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ie?: string | null
          logradouro?: string | null
          municipio?: string | null
          name: string
          nome_fantasia?: string | null
          notes?: string | null
          numero?: string | null
          origem?: string | null
          phone?: string | null
          razao_social?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          bairro?: string | null
          cep?: string | null
          cnpj?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ie?: string | null
          logradouro?: string | null
          municipio?: string | null
          name?: string
          nome_fantasia?: string | null
          notes?: string | null
          numero?: string | null
          origem?: string | null
          phone?: string | null
          razao_social?: string | null
          uf?: string | null
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
      system_settings: {
        Row: {
          created_at: string | null
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          created_at?: string | null
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          created_at?: string | null
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      test_account_creations: {
        Row: {
          created_at: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      test_error_activity_log: {
        Row: {
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          report_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          report_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          report_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_error_activity_log_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "test_error_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_error_activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      test_error_comments: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          id: string
          report_id: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          id?: string
          report_id: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_error_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "test_error_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_error_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      test_error_reports: {
        Row: {
          assigned_to: string | null
          blocker_reason: string | null
          closed_at: string | null
          created_at: string
          description: string
          environment: string
          expected_behavior: string | null
          fix_scope: string | null
          id: string
          in_progress_at: string | null
          last_updated_by: string | null
          module: string
          observed_behavior: string | null
          ready_for_validation_at: string | null
          reported_by: string
          reproduction_steps: string | null
          resolution_summary: string | null
          resolved_at: string | null
          root_cause_notes: string | null
          route: string | null
          severity: string
          sla_status: string | null
          status: string
          systemic_impact: string | null
          title: string
          triaged_at: string | null
          updated_at: string
          validation_notes: string | null
          validator_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          blocker_reason?: string | null
          closed_at?: string | null
          created_at?: string
          description: string
          environment: string
          expected_behavior?: string | null
          fix_scope?: string | null
          id?: string
          in_progress_at?: string | null
          last_updated_by?: string | null
          module: string
          observed_behavior?: string | null
          ready_for_validation_at?: string | null
          reported_by: string
          reproduction_steps?: string | null
          resolution_summary?: string | null
          resolved_at?: string | null
          root_cause_notes?: string | null
          route?: string | null
          severity: string
          sla_status?: string | null
          status: string
          systemic_impact?: string | null
          title: string
          triaged_at?: string | null
          updated_at?: string
          validation_notes?: string | null
          validator_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          blocker_reason?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string
          environment?: string
          expected_behavior?: string | null
          fix_scope?: string | null
          id?: string
          in_progress_at?: string | null
          last_updated_by?: string | null
          module?: string
          observed_behavior?: string | null
          ready_for_validation_at?: string | null
          reported_by?: string
          reproduction_steps?: string | null
          resolution_summary?: string | null
          resolved_at?: string | null
          root_cause_notes?: string | null
          route?: string | null
          severity?: string
          sla_status?: string | null
          status?: string
          systemic_impact?: string | null
          title?: string
          triaged_at?: string | null
          updated_at?: string
          validation_notes?: string | null
          validator_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_error_reports_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_error_reports_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_error_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_error_reports_validator_id_fkey"
            columns: ["validator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      test_error_saved_filters: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_favorite: boolean | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters: Json
          id?: string
          is_favorite?: boolean | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_favorite?: boolean | null
          name?: string
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
      admin_activate_company: {
        Args: {
          p_company_id: string
          p_is_courtesy?: boolean
          p_plan_id: string
        }
        Returns: undefined
      }
      admin_assign_company_owner: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_create_company: {
        Args: {
          p_address?: string
          p_city?: string
          p_cnpj?: string
          p_email?: string
          p_is_courtesy?: boolean
          p_name: string
          p_phone?: string
          p_plan_id?: string
          p_state?: string
          p_zip_code?: string
        }
        Returns: {
          address: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          is_courtesy: boolean
          is_test: boolean | null
          logo_url: string | null
          name: string
          owner_id: string | null
          phone: string | null
          plan_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
          zip_code: string | null
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_get_all_profiles: {
        Args: never
        Returns: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      calculate_kit_stock: { Args: { p_kit_id: string }; Returns: number }
      check_and_log_test_account: { Args: never; Returns: Json }
      concluir_ordem_full: { Args: { _ordem_id: string }; Returns: undefined }
      create_company_v2:
        | {
            Args: { p_name: string; p_plan_id: string; p_user_id?: string }
            Returns: {
              address: string | null
              city: string | null
              cnpj: string | null
              created_at: string
              email: string | null
              id: string
              is_courtesy: boolean
              is_test: boolean | null
              logo_url: string | null
              name: string
              owner_id: string | null
              phone: string | null
              plan_id: string | null
              state: string | null
              status: Database["public"]["Enums"]["company_status"]
              updated_at: string
              zip_code: string | null
            }
            SetofOptions: {
              from: "*"
              to: "companies"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_is_test?: boolean
              p_name: string
              p_plan_id: string
              p_user_id?: string
            }
            Returns: {
              address: string | null
              city: string | null
              cnpj: string | null
              created_at: string
              email: string | null
              id: string
              is_courtesy: boolean
              is_test: boolean | null
              logo_url: string | null
              name: string
              owner_id: string | null
              phone: string | null
              plan_id: string | null
              state: string | null
              status: Database["public"]["Enums"]["company_status"]
              updated_at: string
              zip_code: string | null
            }
            SetofOptions: {
              from: "*"
              to: "companies"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      decrementar_estoque: {
        Args: {
          p_company_id: string
          p_product_id: string
          p_quantidade: number
        }
        Returns: undefined
      }
      dedupe_conference_items: {
        Args: { conf_id: string }
        Returns: {
          kept_rows: number
          removed_rows: number
        }[]
      }
      get_auth_company_id: { Args: never; Returns: string }
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
      get_cron_secret: { Args: never; Returns: string }
      get_my_company_id: { Args: never; Returns: string }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_master: { Args: never; Returns: boolean }
      is_admin_master_dev: { Args: never; Returns: boolean }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_owner: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: boolean
      }
      is_company_owner_or_manager: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_member_of: { Args: { target_company_id: string }; Returns: boolean }
      marcar_ordem_enviada: { Args: { _ordem_id: string }; Returns: undefined }
      marcar_ordem_separada: { Args: { _ordem_id: string }; Returns: undefined }
      recalculate_all_kits_stock: {
        Args: { p_company_id: string }
        Returns: undefined
      }
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
      app_role: "admin" | "moderator" | "user" | "admin_master"
      company_role: "owner" | "manager" | "member" | "admin_master"
      company_status: "active" | "suspended" | "cancelled"
      item_condition:
        | "aprovado"
        | "avariado"
        | "errado"
        | "incompleto"
        | "embalagem_violada"
        | "outro"
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
      quarantine_status: "em_quarentena" | "liberado" | "descartado"
      return_source: "mercado_livre" | "loja" | "manual" | "pdv"
      return_status:
        | "pendente"
        | "em_conferencia"
        | "aguardando_decisao"
        | "concluida"
        | "cancelada"
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
      app_role: ["admin", "moderator", "user", "admin_master"],
      company_role: ["owner", "manager", "member", "admin_master"],
      company_status: ["active", "suspended", "cancelled"],
      item_condition: [
        "aprovado",
        "avariado",
        "errado",
        "incompleto",
        "embalagem_violada",
        "outro",
      ],
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
      quarantine_status: ["em_quarentena", "liberado", "descartado"],
      return_source: ["mercado_livre", "loja", "manual", "pdv"],
      return_status: [
        "pendente",
        "em_conferencia",
        "aguardando_decisao",
        "concluida",
        "cancelada",
      ],
      store_payment_method: ["pix", "cartao", "boleto"],
      store_payment_status: ["pendente", "pago", "cancelado", "expirado"],
      store_sale_mode: ["mercadolivre", "proprio", "hibrido"],
    },
  },
} as const
