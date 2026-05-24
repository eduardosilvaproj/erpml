-- Assign all orphaned records (company_id IS NULL) to the existing company
UPDATE products SET company_id = '248824f8-8443-40a0-aaf1-9209c8c936b8' WHERE company_id IS NULL;
UPDATE invoices SET company_id = '248824f8-8443-40a0-aaf1-9209c8c936b8' WHERE company_id IS NULL;
UPDATE categories SET company_id = '248824f8-8443-40a0-aaf1-9209c8c936b8' WHERE company_id IS NULL;
UPDATE suppliers SET company_id = '248824f8-8443-40a0-aaf1-9209c8c936b8' WHERE company_id IS NULL;
UPDATE customers SET company_id = '248824f8-8443-40a0-aaf1-9209c8c936b8' WHERE company_id IS NULL;
UPDATE sales SET company_id = '248824f8-8443-40a0-aaf1-9209c8c936b8' WHERE company_id IS NULL;
UPDATE conferences SET company_id = '248824f8-8443-40a0-aaf1-9209c8c936b8' WHERE company_id IS NULL;
UPDATE transfer_orders SET company_id = '248824f8-8443-40a0-aaf1-9209c8c936b8' WHERE company_id IS NULL;