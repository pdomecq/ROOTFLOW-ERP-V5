-- =====================================================
-- ROOTFLOW ERP V22 - SISTEMA POR VARIEDADES
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Este SQL:
-- 1. Crea tabla variedades (rábano, mostaza, guisante, etc.)
-- 2. Añade columnas a productos: variedad_id, formato_gramos, estado_inventario
-- 3. Migra automáticamente los productos existentes detectando la variedad
--    y el peso del nombre (ej: "Rábano 15g" → variedad: Rábano, formato: 15g)
-- 4. Añade variedad_id a lotes para simplificar consultas
-- =====================================================

-- 1. Tabla variedades
CREATE TABLE IF NOT EXISTS variedades (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  categoria TEXT DEFAULT 'nutritivos', -- picantes, dulces, coloridos, nutritivos, aromaticos, ornamental, mix
  dias_crecimiento INTEGER DEFAULT 10,
  gramos_por_bandeja INTEGER DEFAULT 100, -- gramos cosechables por bandeja (para Sesión 3)
  precio_kg_referencia DECIMAL(10,2) DEFAULT 0,
  descripcion TEXT,
  imagen_url TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE variedades ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo variedades') THEN
    CREATE POLICY "Acceso completo variedades" ON variedades FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 2. Añadir columnas a productos
ALTER TABLE productos ADD COLUMN IF NOT EXISTS variedad_id INTEGER REFERENCES variedades(id) ON DELETE SET NULL;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS formato_gramos INTEGER; -- NULL si es a granel
ALTER TABLE productos ADD COLUMN IF NOT EXISTS estado_inventario TEXT DEFAULT 'empaquetado';
-- estado_inventario: 'empaquetado' | 'listo_sin_empaquetar' | 'creciendo'

-- 3. Añadir variedad_id a lotes (para estimación de stock)
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS variedad_id INTEGER REFERENCES variedades(id) ON DELETE SET NULL;

-- =====================================================
-- 4. MIGRACIÓN AUTOMÁTICA DE PRODUCTOS EXISTENTES
-- =====================================================

DO $$
DECLARE
  prod RECORD;
  var_nombre TEXT;
  var_id INTEGER;
  peso_extraido INTEGER;
  nombre_limpio TEXT;
  match_resultado TEXT[];
BEGIN
  -- Iterar sobre todos los productos que aún no tienen variedad asignada
  FOR prod IN SELECT id, nombre, categoria FROM productos WHERE variedad_id IS NULL LOOP
    
    -- Intentar extraer peso del nombre (ej "15g", "30 g", "100gr")
    -- Patrón: número seguido opcionalmente de espacio y "g" o "gr" (case insensitive)
    match_resultado := regexp_match(prod.nombre, '(\d+)\s*(g|gr)\b', 'i');
    
    IF match_resultado IS NOT NULL AND array_length(match_resultado, 1) >= 1 THEN
      peso_extraido := match_resultado[1]::INTEGER;
      -- Limpiar el nombre: quitar el peso y palabras como "Bandeja"
      nombre_limpio := regexp_replace(prod.nombre, '\d+\s*(g|gr)\b', '', 'gi');
      nombre_limpio := regexp_replace(nombre_limpio, '\b(bandeja|bandejas|envase|envases|paquete|paquetes|bolsa|bolsas)\b', '', 'gi');
      nombre_limpio := trim(both ' -,.' from nombre_limpio);
      nombre_limpio := regexp_replace(nombre_limpio, '\s+', ' ', 'g');
    ELSE
      peso_extraido := NULL;
      nombre_limpio := trim(prod.nombre);
    END IF;
    
    -- Capitalizar primera letra
    IF length(nombre_limpio) > 0 THEN
      var_nombre := upper(substring(nombre_limpio from 1 for 1)) || lower(substring(nombre_limpio from 2));
    ELSE
      var_nombre := 'Sin clasificar';
    END IF;
    
    -- Buscar o crear la variedad (búsqueda case-insensitive)
    SELECT id INTO var_id FROM variedades WHERE lower(nombre) = lower(var_nombre) LIMIT 1;
    
    IF var_id IS NULL THEN
      INSERT INTO variedades (nombre, categoria) 
      VALUES (var_nombre, COALESCE(prod.categoria, 'nutritivos'))
      RETURNING id INTO var_id;
    END IF;
    
    -- Actualizar el producto
    UPDATE productos 
    SET 
      variedad_id = var_id,
      formato_gramos = peso_extraido,
      estado_inventario = CASE WHEN peso_extraido IS NOT NULL THEN 'empaquetado' ELSE 'listo_sin_empaquetar' END
    WHERE id = prod.id;
    
  END LOOP;
  
  RAISE NOTICE 'Migración completada';
END $$;

-- 5. Migrar lotes: asignar variedad_id desde el producto asociado
UPDATE lotes l
SET variedad_id = p.variedad_id
FROM productos p
WHERE l.producto_id = p.id AND l.variedad_id IS NULL AND p.variedad_id IS NOT NULL;

-- =====================================================
-- 6. RESUMEN
-- =====================================================
SELECT 
  'Variedades creadas: ' || COUNT(*)::TEXT as info FROM variedades
UNION ALL
SELECT 'Productos migrados: ' || COUNT(*)::TEXT FROM productos WHERE variedad_id IS NOT NULL
UNION ALL
SELECT 'Productos sin variedad: ' || COUNT(*)::TEXT FROM productos WHERE variedad_id IS NULL
UNION ALL
SELECT 'Lotes con variedad: ' || COUNT(*)::TEXT FROM lotes WHERE variedad_id IS NOT NULL;
