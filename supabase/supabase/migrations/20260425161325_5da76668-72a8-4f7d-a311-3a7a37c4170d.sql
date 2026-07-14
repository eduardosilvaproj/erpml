-- Update all existing products: SKU internal = EAN
UPDATE products 
SET sku = ean
WHERE ean IS NOT NULL AND ean != '';

-- Ensure SKU and EAN are always synchronized
CREATE OR REPLACE FUNCTION sync_sku_ean()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ean IS NOT NULL AND NEW.ean != '' THEN
    NEW.sku = NEW.ean;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_sku_ean ON products;
CREATE TRIGGER trigger_sync_sku_ean
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION sync_sku_ean();