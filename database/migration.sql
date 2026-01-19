-- ============================================
-- SABROFOOD POS - MIGRATION SCRIPT
-- ============================================

-- 1. Asegurar que existe la columna codigo_barras (si no existe, crearla)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'productos' AND column_name = 'codigo_barras'
    ) THEN
        ALTER TABLE productos ADD COLUMN codigo_barras TEXT UNIQUE;
    END IF;
END $$;

-- 2. Crear índice para búsquedas rápidas por código de barras
CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras 
ON productos(codigo_barras);

-- 3. Habilitar Realtime en la tabla productos
ALTER TABLE productos REPLICA IDENTITY FULL;

-- 4. Políticas RLS para productos (públicas por ahora)
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir SELECT público en productos" ON productos;
CREATE POLICY "Permitir SELECT público en productos"
ON productos FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Permitir INSERT público en productos" ON productos;
CREATE POLICY "Permitir INSERT público en productos"
ON productos FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir UPDATE público en productos" ON productos;
CREATE POLICY "Permitir UPDATE público en productos"
ON productos FOR UPDATE
USING (true);

-- 5. Políticas RLS para ventas
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir SELECT público en ventas" ON ventas;
CREATE POLICY "Permitir SELECT público en ventas"
ON ventas FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Permitir INSERT público en ventas" ON ventas;
CREATE POLICY "Permitir INSERT público en ventas"
ON ventas FOR INSERT
WITH CHECK (true);

-- 6. Comentarios para documentación
COMMENT ON COLUMN productos.codigo_barras IS 'Código de barras único del producto (EAN-13, UPC, etc.)';
COMMENT ON INDEX idx_productos_codigo_barras IS 'Índice para búsquedas rápidas por código de barras';
