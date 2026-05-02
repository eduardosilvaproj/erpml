import { supabase } from "@/integrations/supabase/client";
import type { Product, ProductFormData } from "@/hooks/useProductData";

export const productsService = {
  async fetchProducts(filters: any, companyId: string | null) {
    let query;
    
    if (filters?.search && companyId) {
      query = supabase
        .rpc("search_products_with_suppliers", {
          search_term: filters.search,
          p_company_id: companyId
        })
        .select("*, categories(name), product_suppliers(supplier_id, cost, is_primary, suppliers(id, name)), product_alternative_gtins(gtin), product_supplier_skus(*)");
      
      if (filters?.needsCorrection === "no_sku") {
        query = query.or("sku.is.null,sku.eq.''");
      } else if (filters?.needsCorrection === "no_ean") {
        query = query.eq("ean_pending", true);
      }
    } else {
      query = supabase
        .from("products")
        .select("*, categories(name), product_suppliers(supplier_id, cost, is_primary, suppliers(id, name)), product_alternative_gtins(gtin), product_supplier_skus(*)", { count: "exact" });

      if (companyId) {
        query = query.eq("company_id", companyId);
      }
    }
    
    const statusFilter = filters?.status || "active";
    if (statusFilter === "active") {
      query = query.eq("active", true);
    } else if (statusFilter === "inactive") {
      query = query.eq("active", false);
    }

    if (filters?.category_id) {
      query = query.eq("category_id", filters.category_id);
    }

    if (filters?.needsCorrection === "no_sku") {
      query = query.or("sku.is.null,sku.eq.''");
    } else if (filters?.needsCorrection === "no_ean") {
      query = query.eq("ean_pending", true);
    }

    const sortBy = filters?.sortBy || "created_at";
    const sortOrder = filters?.sortOrder === "asc";
    query = query.order(sortBy, { ascending: sortOrder });

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 10;
    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    let filtered = data as unknown as Product[];
    if (filters?.supplier_id) {
      filtered = filtered.filter((p) =>
        p.product_suppliers?.some((ps) => ps.supplier_id === filters.supplier_id)
      );
    }
    if (filters?.needsCorrection === "no_supplier") {
      filtered = filtered.filter((p) => !p.product_supplier_skus || p.product_supplier_skus.length === 0);
    }

    return { products: filtered, total: count || 0 };
  },

  async fetchAllProducts(companyId: string, activeOnly: boolean = true) {
    const PAGE_SIZE = 1000;
    let all: Product[] = [];
    let page = 0;
    
    while (true) {
      let q = supabase
        .from("products")
        .select("*, categories(name), product_suppliers(supplier_id, cost, is_primary, suppliers(id, name)), product_alternative_gtins(gtin), product_supplier_skus(*)")
        .eq("company_id", companyId)
        .order("name", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      
      if (activeOnly) q = q.eq("active", true);

      const { data, error } = await q;
      if (error) throw error;
      const batch = (data ?? []) as unknown as Product[];
      all = all.concat(batch);
      if (batch.length < PAGE_SIZE) break;
      page++;
      if (page > 200) break; // Safeguard
    }
    return { products: all, total: all.length };
  },

  async createProduct(data: any, companyId: string | null) {
    // Validação no servidor via Edge Function
    const { data: validation, error: validationError } = await supabase.functions.invoke("validate-product", {
      body: { 
        name: data.name,
        description: data.description,
        price: data.price,
        stock_physical: data.stock_physical || 0,
        company_id: companyId
      }
    });

    if (validationError || !validation.valid) {
      throw new Error(validation?.error || validationError?.message || "Erro na validação do produto");
    }

    const { supplier_ids = [], supplier_skus = [], ...productData } = data;
    const insertData = {
      ...productData,
      name: validation.sanitized.name,
      description: validation.sanitized.description,
      barcode: productData.barcode || null,
      ean: productData.ean || productData.barcode || null,
      category_id: productData.category_id || null,
      weight: productData.weight ?? null,
      width: productData.width ?? null,
      height: productData.height ?? null,
      depth: productData.depth ?? null,
      sku_ml: productData.sku_ml || null,
      id_ml: productData.id_ml || null,
      min_stock: productData.min_stock ?? 0,
      company_id: companyId,
      image_url: productData.image_url || null,
      gtin_cx: productData.gtin_cx || null,
      box_quantity: productData.box_quantity ?? null,
    };

    const { data: product, error } = await supabase
      .from("products")
      .insert({ ...insertData, company_id: companyId })
      .select()
      .maybeSingle();
    if (error) throw error;

    if (supplier_ids.length > 0) {
      const supplierLinks = supplier_ids.map((sid: string, i: number) => ({
        product_id: product.id,
        supplier_id: sid,
        cost: data.cost || 0,
        is_primary: i === 0,
      }));
      const { error: linkError } = await supabase.from("product_suppliers").insert(supplierLinks);
      if (linkError) throw linkError;
    }
    
    if (supplier_skus && supplier_skus.length > 0) {
      const skusToInsert = supplier_skus.map((s: any) => ({
        product_id: product.id,
        supplier_name: s.supplier_name,
        supplier_sku: s.supplier_sku
      }));
      const { error: skuError } = await supabase.from("product_supplier_skus").insert(skusToInsert.map(s => ({ ...s, company_id: companyId })));
      if (skuError) throw skuError;
    }

    return product;
  },

  async updateProduct(id: string, data: ProductFormData, companyId: string) {
    const { supplier_ids, supplier_skus, ...productData } = data;
    const updateData = {
      ...productData,
      barcode: productData.barcode || null,
      ean: productData.ean || productData.barcode || null,
      description: productData.description || null,
      category_id: productData.category_id || null,
      weight: productData.weight ?? null,
      width: productData.width ?? null,
      height: productData.height ?? null,
      depth: productData.depth ?? null,
      sku_ml: productData.sku_ml || null,
      id_ml: productData.id_ml || null,
      min_stock: productData.min_stock ?? 0,
      image_url: productData.image_url || null,
      gtin_cx: productData.gtin_cx || null,
      box_quantity: productData.box_quantity ?? null,
    };

    const { error } = await supabase.from("products").update(updateData).eq("id", id).eq("company_id", companyId);
    if (error) throw error;

    const { error: delSuppErr } = await supabase.from("product_suppliers").delete().eq("product_id", id);
    if (delSuppErr) throw delSuppErr;

    if (supplier_ids.length > 0) {
      const supplierLinks = supplier_ids.map((sid, i) => ({
        product_id: id,
        supplier_id: sid,
        cost: data.cost,
        is_primary: i === 0,
      }));
      const { error: insSuppErr } = await supabase.from("product_suppliers").insert(supplierLinks);
      if (insSuppErr) throw insSuppErr;
    }

    const { error: delSkuErr } = await supabase.from("product_supplier_skus").delete().eq("product_id", id);
    if (delSkuErr) throw delSkuErr;

    if (supplier_skus && supplier_skus.length > 0) {
      const skusToInsert = supplier_skus.map(s => ({
        product_id: id,
        supplier_name: s.supplier_name,
        supplier_sku: s.supplier_sku,
        company_id: companyId
      }));
      const { error: insSkuErr } = await supabase.from("product_supplier_skus").insert(skusToInsert);
      if (insSkuErr) throw insSkuErr;
    }
  },

  async deleteProduct(id: string, companyId: string) {
    const tablesToCheck = [
      "sale_items",
      "full_order_items",
      "invoice_items",
      "ml_order_items",
      "transfer_items",
      "conference_items",
      "store_orders"
    ];
    
    let hasHistory = false;

    const checks = await Promise.all(
      tablesToCheck.map(async (table) => {
        try {
          const { count, error } = await (supabase.from(table as any) as any)
            .select("*", { count: "exact", head: true })
            .eq("product_id", id)
            .eq("company_id", companyId);
          
          if (error) return 0;
          return count || 0;
        } catch (e) {
          return 0;
        }
      })
    );

    hasHistory = checks.some(count => count > 0);

    if (hasHistory) {
      const { error } = await supabase
        .from("products")
        .update({ active: false })
        .eq("id", id)
        .eq("company_id", companyId);
      
      if (error) throw error;
      return { deactivated: true };
    } else {
      const { error } = await supabase.from("products").delete().eq("id", id).eq("company_id", companyId);
      if (error) throw error;
      return { deactivated: false };
    }
  },

  async findProductByEanOrSku(params: { ean?: string; sku?: string; companyId: string }) {
    let query = supabase.from("products").select("id, name, price, stock_physical").eq("company_id", params.companyId);
    if (params.ean) {
      query = query.or(`ean.eq.${params.ean},barcode.eq.${params.ean}`);
    } else if (params.sku) {
      query = query.eq("sku", params.sku);
    } else {
      return null;
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  },

  async buscarPorEan(ean: string, companyId: string) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("company_id", companyId)
      .eq("ean", ean)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async atualizarEstoque(id: string, delta: number, companyId: string) {
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("stock_physical")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    
    if (fetchError) throw fetchError;
    if (!product) throw new Error("Produto não encontrado");

    const newStock = (product.stock_physical || 0) + delta;
    
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock_physical: newStock })
      .eq("id", id)
      .eq("company_id", companyId);
    
    if (updateError) throw updateError;
    return newStock;
  },

  async fetchCategories(companyId: string | null) {
    let query = supabase.from("categories").select("*").order("name");
    if (companyId) {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async fetchSuppliers(companyId: string | null) {
    let query = supabase.from("suppliers").select("*").eq("active", true).order("name");
    if (companyId) {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async createSupplier(data: any, companyId: string | null) {
    const { data: supplier, error } = await supabase
      .from("suppliers")
      .insert({ ...data, company_id: companyId })
      .select()
      .maybeSingle();
    if (error) throw error;
    return supplier;
  },

  async deleteSupplier(id: string, companyId: string) {
    const { error } = await supabase.from("suppliers").delete().eq("id", id).eq("company_id", companyId);
    if (error) throw error;
  }
};
