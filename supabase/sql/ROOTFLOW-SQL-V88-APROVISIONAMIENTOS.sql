-- =====================================================================
-- ROOTFLOW ERP — V88: aprovisionamientos reales (semillas, sustrato, envases, etiquetas)
-- =====================================================================
-- 1. Catálogo de materiales, líneas de las facturas de compra y recuentos de inventario.
-- 2. Envase y etiquetas de cada producto (por defecto, el envase según el formato en gramos).
-- 3. Carga de las facturas de aprovisionamiento ya registradas (leídas de sus PDF el 28-oct-2026;
--    datos en supabase/sql/datos/V88-compras-material.json).
-- 4. Corrige la categoría (y la cuenta de su asiento) de 4 gastos mal clasificados.
-- Idempotente: se puede ejecutar varias veces.
-- =====================================================================

CREATE TABLE IF NOT EXISTS materiales (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'otro',          -- semilla | sustrato | envase | etiqueta | mercaderia | otro
  nombre TEXT NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'ud',          -- g | l | ud
  variedad_ids JSONB DEFAULT '[]'::jsonb,     -- semillas y mercadería: variedades que salen de este material
  formatos_gramos JSONB DEFAULT '[]'::jsonb,  -- envases: formatos de producto (g) que van en este envase
  por_defecto BOOLEAN DEFAULT false,          -- sustrato / etiqueta que se usa por defecto
  activo BOOLEAN DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras_material (
  id SERIAL PRIMARY KEY,
  gasto_id INTEGER REFERENCES gastos(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES materiales(id) ON DELETE CASCADE,
  cantidad NUMERIC NOT NULL DEFAULT 0,        -- en la unidad del material (g, l, ud)
  importe_linea NUMERIC NOT NULL DEFAULT 0,   -- importe de la línea en la factura: el coste se reparte con la base del gasto
  descripcion TEXT,
  origen TEXT DEFAULT 'manual',               -- manual | ia | carga_v88
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS compras_material_gasto_idx ON compras_material (gasto_id);

CREATE TABLE IF NOT EXISTS recuentos_material (
  id SERIAL PRIMARY KEY,
  material_id INTEGER REFERENCES materiales(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  cantidad NUMERIC NOT NULL,                  -- lo que hay físicamente, en la unidad del material
  notas TEXT,
  hecho_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE productos ADD COLUMN IF NOT EXISTS envase_material_id INTEGER;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS etiqueta_material_id INTEGER;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS etiquetas_por_unidad NUMERIC;

-- RLS: solo usuarios con sesión del ERP
ALTER TABLE materiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE recuentos_material ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "materiales_auth" ON materiales;
CREATE POLICY "materiales_auth" ON materiales FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "compras_material_auth" ON compras_material;
CREATE POLICY "compras_material_auth" ON compras_material FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "recuentos_material_auth" ON recuentos_material;
CREATE POLICY "recuentos_material_auth" ON recuentos_material FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Realtime
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['materiales', 'compras_material', 'recuentos_material'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ---------- Catálogo de materiales ----------
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'semilla', 'Semilla albahaca italiana', 'g', (SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) FROM variedades WHERE trim(nombre) IN ('Albahaca')), '[]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Semilla albahaca italiana');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'semilla', 'Semilla cilantro partido', 'g', (SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) FROM variedades WHERE trim(nombre) IN ('Cilantro')), '[]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Semilla cilantro partido');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'semilla', 'Semilla rábano Red Rambo', 'g', (SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) FROM variedades WHERE trim(nombre) IN ('Rabano Red')), '[]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Semilla rábano Red Rambo');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'semilla', 'Semilla rábano Daikon', 'g', (SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) FROM variedades WHERE trim(nombre) IN ('Rábano Daikon', 'Rabano verde', 'Rabano')), '[]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Semilla rábano Daikon');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'semilla', 'Semilla amaranto rojo', 'g', (SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) FROM variedades WHERE trim(nombre) IN ('Amaranto Rojo')), '[]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Semilla amaranto rojo');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'semilla', 'Semilla remolacha Bulls Blood', 'g', (SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) FROM variedades WHERE trim(nombre) IN ('Remolacha Roja')), '[]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Semilla remolacha Bulls Blood');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'semilla', 'Semilla brócoli Raab', 'g', (SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) FROM variedades WHERE trim(nombre) IN ('Brocoli')), '[]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Semilla brócoli Raab');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'semilla', 'Semilla rúcula', 'g', (SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) FROM variedades WHERE trim(nombre) IN ('Rucula')), '[]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Semilla rúcula');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'semilla', 'Semilla mostaza Red Giant', 'g', (SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) FROM variedades WHERE trim(nombre) IN ('Mostaza')), '[]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Semilla mostaza Red Giant');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'semilla', 'Semilla guisante Foxy', 'g', (SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) FROM variedades WHERE trim(nombre) IN ('Guisante')), '[]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Semilla guisante Foxy');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'semilla', 'Semilla ajo', 'g', '[]'::jsonb, '[]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Semilla ajo');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'semilla', 'Semilla pak choi tallo blanco', 'g', '[]'::jsonb, '[]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Semilla pak choi tallo blanco');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'sustrato', 'Sustrato fibra de coco (Atami, saco 100 L)', 'l', '[]'::jsonb, '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Sustrato fibra de coco (Atami, saco 100 L)');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'envase', 'Tarrina bisagra oval PET 750 cc', 'ud', '[]'::jsonb, '[30, 50, 60, 100]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Tarrina bisagra oval PET 750 cc');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'envase', 'Envase PET oval tapa bisagra 250 cc', 'ud', '[]'::jsonb, '[15]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Envase PET oval tapa bisagra 250 cc');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'envase', 'Envase PET oval tapa bisagra 150 cc', 'ud', '[]'::jsonb, '[5]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Envase PET oval tapa bisagra 150 cc');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'etiqueta', 'Etiqueta térmica 50×40 mm', 'ud', '[]'::jsonb, '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Etiqueta térmica 50×40 mm');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'etiqueta', 'Pegatina frontal 50×80 mm (360imprimir)', 'ud', '[]'::jsonb, '[]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Pegatina frontal 50×80 mm (360imprimir)');
INSERT INTO materiales (tipo, nombre, unidad, variedad_ids, formatos_gramos, por_defecto)
SELECT 'mercaderia', 'Brotes de cilantro comprados (tarrina 370 cc, Fronda)', 'ud', (SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) FROM variedades WHERE trim(nombre) IN ('Cilantro')), '[]'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE nombre = 'Brotes de cilantro comprados (tarrina 370 cc, Fronda)');

-- ---------- Líneas de las facturas ya registradas ----------
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 44, m.id, 800, 56.18, 'ENV.PET 150 OVAL TAPA BIS 0,800 MIL', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Envase PET oval tapa bisagra 150 cc' AND EXISTS (SELECT 1 FROM gastos WHERE id = 44)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 44 AND x.material_id = m.id AND x.descripcion = 'ENV.PET 150 OVAL TAPA BIS 0,800 MIL');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 44, m.id, 800, 61.56, 'ENV.PET 250 OVAL TAPA BIS 0,800 MIL', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Envase PET oval tapa bisagra 250 cc' AND EXISTS (SELECT 1 FROM gastos WHERE id = 44)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 44 AND x.material_id = m.id AND x.descripcion = 'ENV.PET 250 OVAL TAPA BIS 0,800 MIL');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 69, m.id, 1000, 9.88, 'Etiquetas térmicas 50x40 mm 1000 piezas', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Etiqueta térmica 50×40 mm' AND EXISTS (SELECT 1 FROM gastos WHERE id = 69)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 69 AND x.material_id = m.id AND x.descripcion = 'Etiquetas térmicas 50x40 mm 1000 piezas');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 87, m.id, 400, 72.0, 'ATAMI COCO 100 L × 4', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Sustrato fibra de coco (Atami, saco 100 L)' AND EXISTS (SELECT 1 FROM gastos WHERE id = 87)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 87 AND x.material_id = m.id AND x.descripcion = 'ATAMI COCO 100 L × 4');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 92, m.id, 500, 34.43, 'Basil, Italian Microgreens Seeds 500g', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla albahaca italiana' AND EXISTS (SELECT 1 FROM gastos WHERE id = 92)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 92 AND x.material_id = m.id AND x.descripcion = 'Basil, Italian Microgreens Seeds 500g');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 92, m.id, 250, 22.52, 'Amaranth, Red Microgreens Seeds 250g', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla amaranto rojo' AND EXISTS (SELECT 1 FROM gastos WHERE id = 92)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 92 AND x.material_id = m.id AND x.descripcion = 'Amaranth, Red Microgreens Seeds 250g');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 92, m.id, 1000, 32.69, 'Radish, Red Rambo Microgreens Seeds 1kg', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla rábano Red Rambo' AND EXISTS (SELECT 1 FROM gastos WHERE id = 92)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 92 AND x.material_id = m.id AND x.descripcion = 'Radish, Red Rambo Microgreens Seeds 1kg');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 92, m.id, 500, 17.7, 'Beet, Bulls Blood Microgreens Seeds 500g', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla remolacha Bulls Blood' AND EXISTS (SELECT 1 FROM gastos WHERE id = 92)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 92 AND x.material_id = m.id AND x.descripcion = 'Beet, Bulls Blood Microgreens Seeds 500g');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 92, m.id, 1000, 31.43, 'Cilantro-Coriander, Split Microgreens Seeds 1kg', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla cilantro partido' AND EXISTS (SELECT 1 FROM gastos WHERE id = 92)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 92 AND x.material_id = m.id AND x.descripcion = 'Cilantro-Coriander, Split Microgreens Seeds 1kg');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 94, m.id, 250, 12.86, 'Pegatinas 50 x 80 mm, 250 un.', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Pegatina frontal 50×80 mm (360imprimir)' AND EXISTS (SELECT 1 FROM gastos WHERE id = 94)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 94 AND x.material_id = m.id AND x.descripcion = 'Pegatinas 50 x 80 mm, 250 un.');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 112, m.id, 3000, 32.1, 'Etiquetas térmicas 50x40 mm 1000 piezas × 3', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Etiqueta térmica 50×40 mm' AND EXISTS (SELECT 1 FROM gastos WHERE id = 112)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 112 AND x.material_id = m.id AND x.descripcion = 'Etiquetas térmicas 50x40 mm 1000 piezas × 3');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 113, m.id, 500, 96.8, 'TARRINA BISAGRA OVALADA PET 750 CC B-50 × 500', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Tarrina bisagra oval PET 750 cc' AND EXISTS (SELECT 1 FROM gastos WHERE id = 113)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 113 AND x.material_id = m.id AND x.descripcion = 'TARRINA BISAGRA OVALADA PET 750 CC B-50 × 500');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 117, m.id, 20000, 157.5, 'CILANTRO Coriander, Split 20 kg', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla cilantro partido' AND EXISTS (SELECT 1 FROM gastos WHERE id = 117)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 117 AND x.material_id = m.id AND x.descripcion = 'CILANTRO Coriander, Split 20 kg');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 117, m.id, 4000, 159.84, 'BASIL-IT Basil, Italian 4 kg', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla albahaca italiana' AND EXISTS (SELECT 1 FROM gastos WHERE id = 117)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 117 AND x.material_id = m.id AND x.descripcion = 'BASIL-IT Basil, Italian 4 kg');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 119, m.id, 18, 100.8, 'BROTES CILANTRO (370 CC) × 18', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Brotes de cilantro comprados (tarrina 370 cc, Fronda)' AND EXISTS (SELECT 1 FROM gastos WHERE id = 119)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 119 AND x.material_id = m.id AND x.descripcion = 'BROTES CILANTRO (370 CC) × 18');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 120, m.id, 400, 72.0, 'ATAMI COCO 100 L × 4', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Sustrato fibra de coco (Atami, saco 100 L)' AND EXISTS (SELECT 1 FROM gastos WHERE id = 120)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 120 AND x.material_id = m.id AND x.descripcion = 'ATAMI COCO 100 L × 4');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 133, m.id, 1200, 209.09, 'TARRINA BISAGRA OVALADA PET 750 CC B-50 × 1200 (10 % dto.)', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Tarrina bisagra oval PET 750 cc' AND EXISTS (SELECT 1 FROM gastos WHERE id = 133)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 133 AND x.material_id = m.id AND x.descripcion = 'TARRINA BISAGRA OVALADA PET 750 CC B-50 × 1200 (10 % dto.)');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 151, m.id, 400, 74.0, 'ATAMI COCO 100 L × 3 + COCO POROSITY 100 L × 1', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Sustrato fibra de coco (Atami, saco 100 L)' AND EXISTS (SELECT 1 FROM gastos WHERE id = 151)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 151 AND x.material_id = m.id AND x.descripcion = 'ATAMI COCO 100 L × 3 + COCO POROSITY 100 L × 1');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 162, m.id, 3000, 31.5, 'RAD-DAI Radish, Daikon 3 kg', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla rábano Daikon' AND EXISTS (SELECT 1 FROM gastos WHERE id = 162)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 162 AND x.material_id = m.id AND x.descripcion = 'RAD-DAI Radish, Daikon 3 kg');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 162, m.id, 3000, 59.85, 'RAD-RAMBO Radish, Red Rambo 3 kg', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla rábano Red Rambo' AND EXISTS (SELECT 1 FROM gastos WHERE id = 162)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 162 AND x.material_id = m.id AND x.descripcion = 'RAD-RAMBO Radish, Red Rambo 3 kg');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 162, m.id, 500, 26.25, 'AMARANTH-RED Amaranth, Red 0,5 kg', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla amaranto rojo' AND EXISTS (SELECT 1 FROM gastos WHERE id = 162)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 162 AND x.material_id = m.id AND x.descripcion = 'AMARANTH-RED Amaranth, Red 0,5 kg');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 162, m.id, 2500, 23.63, 'BROCCOLI-RAAB Broccoli, Raab 2,5 kg', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla brócoli Raab' AND EXISTS (SELECT 1 FROM gastos WHERE id = 162)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 162 AND x.material_id = m.id AND x.descripcion = 'BROCCOLI-RAAB Broccoli, Raab 2,5 kg');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 162, m.id, 1500, 17.33, 'ARUGULA Arugula, Rocket 1,5 kg', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla rúcula' AND EXISTS (SELECT 1 FROM gastos WHERE id = 162)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 162 AND x.material_id = m.id AND x.descripcion = 'ARUGULA Arugula, Rocket 1,5 kg');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 162, m.id, 3000, 69.3, 'MUSTARD-RG Mustard, Red Giant 3 kg', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla mostaza Red Giant' AND EXISTS (SELECT 1 FROM gastos WHERE id = 162)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 162 AND x.material_id = m.id AND x.descripcion = 'MUSTARD-RG Mustard, Red Giant 3 kg');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 162, m.id, 3000, 11.03, 'PEA-FOXY Pea, Foxy 3 kg', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla guisante Foxy' AND EXISTS (SELECT 1 FROM gastos WHERE id = 162)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 162 AND x.material_id = m.id AND x.descripcion = 'PEA-FOXY Pea, Foxy 3 kg');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 162, m.id, 1000, 39.9, 'GARLIC 1 kg', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla ajo' AND EXISTS (SELECT 1 FROM gastos WHERE id = 162)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 162 AND x.material_id = m.id AND x.descripcion = 'GARLIC 1 kg');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 162, m.id, 2500, 49.88, 'PAKCHOI-WHT PakChoi, WhiteStem 2,5 kg', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Semilla pak choi tallo blanco' AND EXISTS (SELECT 1 FROM gastos WHERE id = 162)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 162 AND x.material_id = m.id AND x.descripcion = 'PAKCHOI-WHT PakChoi, WhiteStem 2,5 kg');
INSERT INTO compras_material (gasto_id, material_id, cantidad, importe_linea, descripcion, origen)
SELECT 164, m.id, 600, 108.0, 'ATAMI COCO 100 L × 6', 'carga_v88' FROM materiales m
WHERE m.nombre = 'Sustrato fibra de coco (Atami, saco 100 L)' AND EXISTS (SELECT 1 FROM gastos WHERE id = 164)
  AND NOT EXISTS (SELECT 1 FROM compras_material x WHERE x.gasto_id = 164 AND x.material_id = m.id AND x.descripcion = 'ATAMI COCO 100 L × 6');

-- ---------- Gastos mal clasificados (y la cuenta de su asiento) ----------
-- 151: sustrato de Organic Growshop (estaba en "otros"); 162: semillas de HYDRO/MP Seeds (estaba en "otros");
-- 59: era fontanería de Leroy Merlin (codos de PVC, broca), no sustrato; 86: bidón de Wallapop, no sustrato.
UPDATE gastos SET categoria = 'sustratos' WHERE id = 151 AND categoria = 'otros';
UPDATE gastos SET categoria = 'semillas' WHERE id = 162 AND categoria = 'otros';
UPDATE gastos SET categoria = 'reparaciones' WHERE id = 59 AND categoria = 'sustratos';
UPDATE gastos SET categoria = 'otros' WHERE id = 86 AND categoria = 'sustratos';
UPDATE asiento_lineas SET cuenta = '602', concepto = 'Compras de otros aprovisionamientos'
 WHERE cuenta = '629' AND debe > 0 AND asiento_id IN (SELECT id FROM asientos_contables WHERE referencia = 'GAS-151');
UPDATE asiento_lineas SET cuenta = '601', concepto = 'Compras de materias primas'
 WHERE cuenta = '629' AND debe > 0 AND asiento_id IN (SELECT id FROM asientos_contables WHERE referencia = 'GAS-162');
UPDATE asiento_lineas SET cuenta = '622', concepto = 'Reparaciones y conservación'
 WHERE cuenta = '602' AND debe > 0 AND asiento_id IN (SELECT id FROM asientos_contables WHERE referencia = 'GAS-59');
UPDATE asiento_lineas SET cuenta = '629', concepto = 'Otros servicios'
 WHERE cuenta = '602' AND debe > 0 AND asiento_id IN (SELECT id FROM asientos_contables WHERE referencia = 'GAS-86');

NOTIFY pgrst, 'reload schema';

SELECT 'V88 OK — ' || (SELECT count(*) FROM materiales) || ' materiales y ' || (SELECT count(*) FROM compras_material) || ' líneas de compra' AS resultado;
