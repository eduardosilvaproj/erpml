ALTER TABLE public.invoice_items
  ADD COLUMN xml_ean text DEFAULT '',
  ADD COLUMN xml_ncm text DEFAULT '',
  ADD COLUMN xml_cfop text DEFAULT '',
  ADD COLUMN xml_unit text DEFAULT 'UN';