-- =====================================================
-- ROOTFLOW ERP V85b — CORRECCIÓN DE LAS FACTURAS DE BELLBRO + TOKEN DE LA REVISIÓN DEL CORREO
-- Ejecutar DESPUÉS de ROOTFLOW-SQL-V85-FACTURAS-RECIBIDAS.sql (una sola vez; se puede repetir)
-- =====================================================
-- Base, IVA y retención de IRPF (19 %) copiados de cada PDF. gastos.importe = total pagado.
-- Después, en el ERP → Gastos, pulsa "Rehacer asientos" para que contabilidad recoja el cambio.

UPDATE gastos SET iva_tipo='general', base_imponible=525.00, iva_importe=110.25, retencion_pct=19, retencion_importe=99.75,  importe=535.50, numero_factura='000004' WHERE id=27;   -- abril
UPDATE gastos SET iva_tipo='general', base_imponible=539.95, iva_importe=110.25, retencion_pct=19, retencion_importe=102.59, importe=547.61, numero_factura='000005' WHERE id=62;   -- mayo (+ luz sin IVA)
UPDATE gastos SET iva_tipo='general', base_imponible=551.61, iva_importe=110.25, retencion_pct=19, retencion_importe=104.81, importe=557.05, numero_factura='000008' WHERE id=106;  -- junio (+ agua sin IVA)
UPDATE gastos SET iva_tipo='general', base_imponible=525.00, iva_importe=110.25, retencion_pct=19, retencion_importe=99.75,  importe=535.50, numero_factura='000012' WHERE id=123;  -- julio
UPDATE gastos SET iva_tipo='general', base_imponible=525.00, iva_importe=110.25, retencion_pct=19, retencion_importe=99.75,  importe=535.50, numero_factura='000017' WHERE id=142;  -- agosto
UPDATE gastos SET iva_tipo='general', base_imponible=525.00, iva_importe=110.25, retencion_pct=19, retencion_importe=99.75,  importe=535.50, numero_factura='000020' WHERE id=144;  -- septiembre
UPDATE gastos SET iva_tipo='general', base_imponible=525.00, iva_importe=110.25, retencion_pct=19, retencion_importe=99.75,  importe=535.50, numero_factura='000022' WHERE id=153;  -- octubre
UPDATE gastos SET iva_tipo='general', base_imponible=134.82, iva_importe=28.31,  retencion_pct=19, retencion_importe=25.62,  importe=137.51, numero_factura='000024' WHERE id=155;  -- repercusión luz sept.
UPDATE gastos SET iva_tipo='reducido', base_imponible=27.92, iva_importe=2.79,   retencion_pct=0,  retencion_importe=0,      importe=30.71,  numero_factura='000023' WHERE id=154;  -- agua sept. (10 %)

-- Token aleatorio con el que la revisión diaria del correo mete facturas en la bandeja (solo lo lee el servidor)
INSERT INTO config_privada (clave, valor)
SELECT 'token_importar_facturas', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
WHERE NOT EXISTS (SELECT 1 FROM config_privada WHERE clave = 'token_importar_facturas');

SELECT 'V85b OK — ' || (SELECT COUNT(*) FROM gastos WHERE retencion_importe > 0) || ' gastos con retención' AS resultado;
