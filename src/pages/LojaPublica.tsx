import { useParams, useNavigate } from "react-router-dom";
import { usePublicStore, usePublicStoreProducts, StoreProduct } from "@/hooks/useStoreData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, ExternalLink, CreditCard, MessageCircle, Store } from "lucide-react";

function ProductCard({ sp, saleMode, primaryColor, storeSlug }: {
  sp: StoreProduct;
  saleMode: string;
  primaryColor: string;
  storeSlug: string;
}) {
  const navigate = useNavigate();
  const product = sp.products!;
  const price = sp.custom_price ?? product.price;
  const mlUrl = product.id_ml ? `https://www.mercadolivre.com.br/p/${product.id_ml}` : null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-square bg-muted flex items-center justify-center">
        <Store className="h-16 w-16 text-muted-foreground/30" />
      </div>
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-foreground line-clamp-2">{product.name}</h3>
        {(sp.custom_description || product.description) && (
          <p className="text-sm text-muted-foreground line-clamp-2">{sp.custom_description || product.description}</p>
        )}
        <p className="text-2xl font-bold" style={{ color: primaryColor }}>
          R$ {Number(price).toFixed(2)}
        </p>
        <div className="flex flex-col gap-2">
          {(saleMode === "proprio" || saleMode === "hibrido") && (
            <Button
              className="w-full"
              style={{ backgroundColor: primaryColor }}
              onClick={() => navigate(`/loja/${storeSlug}/checkout?product=${product.id}&sp=${sp.id}`)}
            >
              <CreditCard className="h-4 w-4 mr-2" /> Comprar
            </Button>
          )}
          {(saleMode === "mercadolivre" || saleMode === "hibrido") && mlUrl && (
            <Button variant="outline" className="w-full" asChild>
              <a href={mlUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" /> Comprar no Mercado Livre
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LojaPublica() {
  const { slug } = useParams<{ slug: string }>();
  const { data: store, isLoading } = usePublicStore(slug);
  const { data: products, isLoading: productsLoading } = usePublicStoreProducts(store?.id);

  if (isLoading || productsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Store className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Loja não encontrada</h1>
          <p className="text-muted-foreground">Esta loja não existe ou está inativa.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border" style={{ borderBottomColor: store.primary_color + "40" }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.store_name} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: store.primary_color + "20" }}>
                <Store className="h-5 w-5" style={{ color: store.primary_color }} />
              </div>
            )}
            <h1 className="text-xl font-bold text-foreground">{store.store_name}</h1>
          </div>
          {store.whatsapp && (
            <Button variant="outline" size="sm" asChild>
              <a href={`https://wa.me/55${store.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
              </a>
            </Button>
          )}
        </div>
      </header>

      {/* Banner */}
      {store.banner_url && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <img src={store.banner_url} alt="Banner" className="w-full h-48 md:h-64 object-cover rounded-2xl" />
        </div>
      )}

      {/* Description */}
      {store.description && (
        <div className="max-w-6xl mx-auto px-4 mt-6">
          <p className="text-muted-foreground">{store.description}</p>
        </div>
      )}

      {/* Products */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {!products || products.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nenhum produto disponível</h2>
            <p className="text-muted-foreground">Esta loja ainda não tem produtos à venda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map(sp => (
              <ProductCard
                key={sp.id}
                sp={sp}
                saleMode={store.sale_mode}
                primaryColor={store.primary_color}
                storeSlug={store.slug}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          {store.store_name} • Powered by ERP ML
        </div>
      </footer>
    </div>
  );
}
