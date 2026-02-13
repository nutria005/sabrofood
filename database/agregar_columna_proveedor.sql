-- DOCUMENTACIÓN: Columna 'proveedor' en tabla productos
-- NOTA: Esta columna ya existe en la base de datos (verificado 2026-01-16)

-- Estructura de la columna:
-- - Nombre: proveedor
-- - Tipo: TEXT
-- - Nullable: SI (campo opcional)
-- - Descripción: Proveedor del producto (opcional)
-- - Valores ejemplo: Purina, Befoods, Cruce, Argentinos, Mya Spa, etc.

-- Para verificar la columna en cualquier momento:
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'productos' AND column_name = 'proveedor';

-- Si en el futuro necesitas agregar la columna en otra base de datos:
-- ALTER TABLE productos ADD COLUMN IF NOT EXISTS proveedor TEXT;
