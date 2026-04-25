-- Deletar ordens sem frete_ml ou sem company_id
DELETE FROM full_orders 
WHERE frete_ml IS NULL OR frete_ml = '';
