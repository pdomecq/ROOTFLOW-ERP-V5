-- =====================================================
-- ROOTFLOW ERP V28 - NOTIFICACIONES + RECETAS POR VARIEDAD
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- 1. Tabla notificaciones_config (compartida entre dispositivos)
-- 2. Recetas por variedad (no por producto)
-- =====================================================

-- =====================================================
-- 1. CONFIGURACIÓN DE NOTIFICACIONES (sincronizada)
-- =====================================================
-- Se guarda UNA fila global para toda la empresa, así todos
-- los dispositivos/usuarios ven la misma configuración activa

CREATE TABLE IF NOT EXISTS notificaciones_config (
  id INTEGER PRIMARY KEY DEFAULT 1, -- siempre id=1, fila única
  
  -- Slack
  slack_activo BOOLEAN DEFAULT TRUE,
  slack_usar_edge_function BOOLEAN DEFAULT TRUE,
  slack_webhook_url TEXT, -- solo se usa si NO se usa Edge Function
  slack_canal_default TEXT DEFAULT '#rootflow-alertas',
  slack_mencionar_en_criticas BOOLEAN DEFAULT TRUE,
  
  -- Granular: qué tipos de eventos disparan notificación Slack
  -- (true = enviar; false = no enviar)
  notif_pedido_nuevo BOOLEAN DEFAULT TRUE,
  notif_pedido_estado BOOLEAN DEFAULT FALSE,    -- cambios de estado
  notif_pedido_atrasado BOOLEAN DEFAULT TRUE,   -- entregas atrasadas
  
  notif_stock_bajo BOOLEAN DEFAULT TRUE,
  notif_stock_critico BOOLEAN DEFAULT TRUE,     -- stock 0 o negativo
  
  notif_cosecha_lista BOOLEAN DEFAULT TRUE,     -- cosecha pendiente hoy
  notif_siembra_pendiente BOOLEAN DEFAULT TRUE, -- siembra urgente
  
  notif_turno_asignado BOOLEAN DEFAULT TRUE,    -- al asignar turno
  notif_turno_recordatorio BOOLEAN DEFAULT TRUE, -- 1 día antes
  notif_turno_conflicto BOOLEAN DEFAULT TRUE,   -- conflicto con ausencia
  
  notif_pago_proveedor BOOLEAN DEFAULT TRUE,    -- pago próximo a vencer
  notif_factura_vencida BOOLEAN DEFAULT TRUE,
  
  notif_muestra_pendiente BOOLEAN DEFAULT TRUE, -- muestra a entregar
  notif_lead_seguimiento BOOLEAN DEFAULT FALSE, -- recordatorios CRM
  
  notif_resumen_diario BOOLEAN DEFAULT FALSE,   -- resumen 9:00 cada día
  notif_resumen_diario_hora TIME DEFAULT '09:00',
  
  -- Email (legado, se mantiene)
  email_activo BOOLEAN DEFAULT FALSE,
  email_remitente TEXT DEFAULT 'Rootflow <noreply@rootflow.es>',
  email_destinatarios_default TEXT,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Insertar la fila única si no existe
INSERT INTO notificaciones_config (id) 
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE notificaciones_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo notificaciones_config') THEN
    CREATE POLICY "Acceso completo notificaciones_config" ON notificaciones_config FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =====================================================
-- 2. RECETAS POR VARIEDAD
-- =====================================================
-- Antes: recetas_produccion.producto_id → ahora: recetas_produccion.variedad_id

ALTER TABLE recetas_produccion ADD COLUMN IF NOT EXISTS variedad_id INTEGER REFERENCES variedades(id) ON DELETE CASCADE;

-- Migrar recetas existentes: si tienen producto_id, copiar variedad_id desde el producto
UPDATE recetas_produccion r
SET variedad_id = p.variedad_id
FROM productos p
WHERE r.producto_id = p.id 
  AND r.variedad_id IS NULL 
  AND p.variedad_id IS NOT NULL;

-- Ya no es obligatoria producto_id; la dejamos opcional como fallback
ALTER TABLE recetas_produccion ALTER COLUMN producto_id DROP NOT NULL;

-- Índice para acceso rápido por variedad
CREATE INDEX IF NOT EXISTS idx_recetas_variedad ON recetas_produccion(variedad_id);

-- =====================================================
-- 3. AÑADIR CAMPO usuario_id A turnos (para "mis turnos")
-- =====================================================
-- Ya existe socio_id, pero añadimos índice por fecha para vista semanal
CREATE INDEX IF NOT EXISTS idx_turnos_socio_fecha ON turnos(socio_id, fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos(fecha);

-- =====================================================
-- 4. PLANTILLAS DE TURNOS (para crear semanas rápido)
-- =====================================================
CREATE TABLE IF NOT EXISTS plantillas_turnos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  -- JSON con array de {socio_id, dia_semana (0-6), tipo, hora, duracion_minutos, notas}
  turnos_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plantillas_turnos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo plantillas_turnos') THEN
    CREATE POLICY "Acceso completo plantillas_turnos" ON plantillas_turnos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Refrescar schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'V28 OK - Notificaciones + Recetas por variedad + Plantillas turnos' as resultado;
