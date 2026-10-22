-- ============================================
-- ROOTFLOW ERP - CONFIGURAR STORAGE
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- ==================== CREAR BUCKET ====================
-- NOTA: Si el bucket ya existe, esta línea dará error (ignorar)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('facturas-gastos', 'facturas-gastos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ==================== ELIMINAR POLÍTICAS EXISTENTES ====================
DROP POLICY IF EXISTS "Permitir subida autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir lectura pública" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminar autenticados" ON storage.objects;
DROP POLICY IF EXISTS "facturas_upload" ON storage.objects;
DROP POLICY IF EXISTS "facturas_read" ON storage.objects;
DROP POLICY IF EXISTS "facturas_delete" ON storage.objects;

-- ==================== CREAR POLÍTICAS DE STORAGE ====================
-- Permitir a usuarios autenticados subir archivos
CREATE POLICY "facturas_upload" ON storage.objects
    FOR INSERT 
    TO authenticated
    WITH CHECK (bucket_id = 'facturas-gastos');

-- Permitir lectura pública (para ver las facturas)
CREATE POLICY "facturas_read" ON storage.objects
    FOR SELECT 
    TO public
    USING (bucket_id = 'facturas-gastos');

-- Permitir a usuarios autenticados eliminar sus archivos
CREATE POLICY "facturas_delete" ON storage.objects
    FOR DELETE 
    TO authenticated
    USING (bucket_id = 'facturas-gastos');

-- Permitir actualizar
CREATE POLICY "facturas_update" ON storage.objects
    FOR UPDATE 
    TO authenticated
    USING (bucket_id = 'facturas-gastos');

-- ==================== VERIFICACIÓN ====================
SELECT '✅ Bucket facturas-gastos configurado correctamente' as resultado;
