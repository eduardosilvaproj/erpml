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
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      conference_items: {
        Row: {
          conference_id: string
          created_at: string
          expected_quantity: number
          id: string
          invoice_item_id: string
          product_id: string | null
          scanned_quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          conference_id: string
          created_at?: string
          expected_quantity?: number
          id?: string
          invoice_item_id: string
          product_id?: string | null
          scanned_quantity?: number
          status?: string
          updated_at?: string
        }
        Update: {
          conference_id?: string
          created_at?: string
          expected_quantity?: number
          id?: string
          invoice_item_id?: string
          product_id?: string | null
          scanned_quantity?: number
          status?: string
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
        ]
      }
      conferences: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          invoice_id: string
          notes: string | null
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conferences_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
          xml_code: string
          xml_description: string
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
          xml_code: string
          xml_description: string
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
          xml_code?: string
          xml_description?: string
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
        ]
      }
      invoices: {
        Row: {
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
        Relationships: []
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
            foreignKeyName: "product_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          barcode: string | null
          category_id: string | null
          cost: number
          created_at: string
          depth: number | null
          description: string | null
          height: number | null
          id: string
          id_ml: string | null
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
          category_id?: string | null
          cost?: number
          created_at?: string
          depth?: number | null
          description?: string | null
          height?: number | null
          id?: string
          id_ml?: string | null
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
          category_id?: string | null
          cost?: number
          created_at?: string
          depth?: number | null
          description?: string | null
          height?: number | null
          id?: string
          id_ml?: string | null
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
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          cnpj: string | null
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
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
