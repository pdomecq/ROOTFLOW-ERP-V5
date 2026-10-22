-- =====================================================
-- ROOTFLOW ERP V27 - FIX MUESTRAS + LIMPIEZA SELECTIVA
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- 1. Añade columnas que faltan en muestras
-- 2. BORRA: productos, variedades, pedidos, lotes, muestras,
--    presupuestos, facturas DE VENTA, leads
-- 3. MANTIENE: gastos, pagos a proveedores, clientes,
--    socios, proveedores, turnos, ausencias
-- ⚠️ DESTRUCTIVO: confirmar antes de pulsar "Run"
-- =====================================================

-- =====================================================
-- PARTE 1: ARREGLAR TABLA MUESTRAS
-- =====================================================

ALTER TABLE muestras ADD COLUMN IF NOT EXISTS fecha_siguiente DATE;
ALTER TABLE muestras ADD COLUMN IF NOT EXISTS lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE muestras ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE muestras ADD COLUMN IF NOT EXISTS nombre_contacto TEXT;
ALTER TABLE muestras ADD COLUMN IF NOT EXISTS empresa TEXT;
ALTER TABLE muestras ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE muestras ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE muestras ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE muestras ADD COLUMN IF NOT EXISTS tipo_negocio TEXT DEFAULT 'restaurante';
ALTER TABLE muestras ADD COLUMN IF NOT EXISTS fecha_entrega DATE;
ALTER TABLE muestras ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente';
ALTER TABLE muestras ADD COLUMN IF NOT EXISTS notas TEXT;

-- Forzar refresh del schema cache (PostgREST)
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- PARTE 2: LIMPIEZA SELECTIVA
-- =====================================================
-- BORRAR (relacionado con ventas/operativa)

-- Pedidos y sus items
DELETE FROM pedido_items;
DELETE FROM pedidos;

-- Pedidos recurrentes
DELETE FROM pedidos_recurrentes_items;
DELETE FROM pedidos_recurrentes;

-- Facturas DE VENTA (las que se generan a partir de pedidos)
-- ⚠️ NO TOCA gastos ni facturas de gastos
DELETE FROM facturas;

-- Presupuestos
DELETE FROM presupuesto_items;
DELETE FROM presupuestos;

-- Muestras
DELETE FROM muestra_items;
DELETE FROM muestras;

-- Tarifas personalizadas (dependen de productos)
DELETE FROM tarifas_cliente;

-- Lotes (dependen de productos/variedades)
DELETE FROM lotes;

-- Movimientos de stock (auditoría reseteada)
DELETE FROM movimientos_stock;

-- Mermas (si la tabla existe)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mermas') THEN
    DELETE FROM mermas;
  END IF;
END $$;

-- Productos
DELETE FROM productos;

-- Variedades
DELETE FROM variedades;

-- LEADS (CRM - prospectos)
DELETE FROM leads;

-- =====================================================
-- NO BORRAR (datos contables y maestros)
-- =====================================================
-- ✅ gastos                  → SE MANTIENE (todas las facturas de gasto)
-- ✅ pagos_proveedor         → SE MANTIENE (pagos programados a proveedores)
-- ✅ clientes                → SE MANTIENE
-- ✅ cliente_contactos       → SE MANTIENE
-- ✅ proveedores             → SE MANTIENE
-- ✅ socios                  → SE MANTIENE
-- ✅ turnos                  → SE MANTIENE
-- ✅ ausencias_socios        → SE MANTIENE
-- ✅ tareas                  → SE MANTIENE
-- ✅ asientos contables      → SE MANTIENE (si los hubiera)

-- =====================================================
-- RESETEAR SECUENCIAS DE LO BORRADO
-- =====================================================
ALTER SEQUENCE IF EXISTS productos_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS variedades_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS lotes_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS pedidos_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS pedido_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS facturas_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS muestras_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS muestra_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS pedidos_recurrentes_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS pedidos_recurrentes_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS presupuesto_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS movimientos_stock_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS leads_id_seq RESTART WITH 1;

-- =====================================================
-- RESUMEN
-- =====================================================
SELECT 'BORRADOS' as tipo, 'Productos' as tabla, COUNT(*)::TEXT as restantes FROM productos
UNION ALL SELECT 'BORRADOS', 'Variedades', COUNT(*)::TEXT FROM variedades
UNION ALL SELECT 'BORRADOS', 'Pedidos', COUNT(*)::TEXT FROM pedidos
UNION ALL SELECT 'BORRADOS', 'Lotes', COUNT(*)::TEXT FROM lotes
UNION ALL SELECT 'BORRADOS', 'Muestras', COUNT(*)::TEXT FROM muestras
UNION ALL SELECT 'BORRADOS', 'Facturas (venta)', COUNT(*)::TEXT FROM facturas
UNION ALL SELECT 'BORRADOS', 'Presupuestos', COUNT(*)::TEXT FROM presupuestos
UNION ALL SELECT 'BORRADOS', 'Leads', COUNT(*)::TEXT FROM leads
UNION ALL SELECT 'BORRADOS', 'Movimientos stock', COUNT(*)::TEXT FROM movimientos_stock
UNION ALL SELECT '---', '---', '---'
UNION ALL SELECT 'MANTENIDOS', 'Gastos', COUNT(*)::TEXT FROM gastos
UNION ALL SELECT 'MANTENIDOS', 'Pagos proveedor', COUNT(*)::TEXT FROM pagos_proveedor
UNION ALL SELECT 'MANTENIDOS', 'Clientes', COUNT(*)::TEXT FROM clientes
UNION ALL SELECT 'MANTENIDOS', 'Proveedores', COUNT(*)::TEXT FROM proveedores
UNION ALL SELECT 'MANTENIDOS', 'Socios', COUNT(*)::TEXT FROM socios
UNION ALL SELECT 'MANTENIDOS', 'Turnos', COUNT(*)::TEXT FROM turnos;
