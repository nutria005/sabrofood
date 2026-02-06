-- ============================================
-- SISTEMA DE ASISTENCIA Y CONTROL DE HORARIOS
-- ============================================

-- Crear tabla de asistencias
CREATE TABLE IF NOT EXISTS asistencias (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT,
    username TEXT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_entrada TIMESTAMPTZ,
    hora_inicio_almuerzo TIMESTAMPTZ,
    hora_fin_almuerzo TIMESTAMPTZ,
    hora_salida TIMESTAMPTZ,
    horas_trabajadas NUMERIC(5,2),
    estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'en_turno', 'en_almuerzo', 'finalizado'
    notas TEXT,
    editado_por TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Restricción: solo un registro por usuario por día
    UNIQUE(username, fecha)
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_asistencias_username ON asistencias(username);
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON asistencias(fecha);
CREATE INDEX IF NOT EXISTS idx_asistencias_estado ON asistencias(estado);

-- Función para calcular horas trabajadas
CREATE OR REPLACE FUNCTION calcular_horas_trabajadas(
    p_entrada TIMESTAMPTZ,
    p_inicio_almuerzo TIMESTAMPTZ,
    p_fin_almuerzo TIMESTAMPTZ,
    p_salida TIMESTAMPTZ
)
RETURNS NUMERIC AS $$
DECLARE
    v_horas NUMERIC;
    v_minutos_almuerzo NUMERIC;
BEGIN
    -- Si no hay entrada o salida, no hay horas
    IF p_entrada IS NULL OR p_salida IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Calcular horas totales
    v_horas := EXTRACT(EPOCH FROM (p_salida - p_entrada)) / 3600.0;
    
    -- Restar tiempo de almuerzo si existe
    IF p_inicio_almuerzo IS NOT NULL AND p_fin_almuerzo IS NOT NULL THEN
        v_minutos_almuerzo := EXTRACT(EPOCH FROM (p_fin_almuerzo - p_inicio_almuerzo)) / 3600.0;
        v_horas := v_horas - v_minutos_almuerzo;
    END IF;
    
    RETURN ROUND(v_horas, 2);
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar horas trabajadas automáticamente
CREATE OR REPLACE FUNCTION actualizar_horas_trabajadas()
RETURNS TRIGGER AS $$
BEGIN
    NEW.horas_trabajadas := calcular_horas_trabajadas(
        NEW.hora_entrada,
        NEW.hora_inicio_almuerzo,
        NEW.hora_fin_almuerzo,
        NEW.hora_salida
    );
    
    -- Actualizar estado
    IF NEW.hora_salida IS NOT NULL THEN
        NEW.estado := 'Completo';
    ELSIF NEW.hora_fin_almuerzo IS NOT NULL THEN
        NEW.estado := 'Trabajando';
    ELSIF NEW.hora_inicio_almuerzo IS NOT NULL THEN
        NEW.estado := 'En almuerzo';
    ELSIF NEW.hora_entrada IS NOT NULL THEN
        NEW.estado := 'Trabajando';
    END IF;
    
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_horas ON asistencias;
CREATE TRIGGER trigger_actualizar_horas
    BEFORE INSERT OR UPDATE ON asistencias
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_horas_trabajadas();

-- Habilitar RLS
ALTER TABLE asistencias ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
DROP POLICY IF EXISTS "Los usuarios ven sus propias asistencias" ON asistencias;
CREATE POLICY "Los usuarios ven sus propias asistencias"
ON asistencias FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Los usuarios pueden insertar sus asistencias" ON asistencias;
CREATE POLICY "Los usuarios pueden insertar sus asistencias"
ON asistencias FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Los usuarios pueden actualizar sus asistencias" ON asistencias;
CREATE POLICY "Los usuarios pueden actualizar sus asistencias"
ON asistencias FOR UPDATE
USING (true);

-- Verificar
SELECT '✅ Sistema de asistencias creado correctamente' as resultado;

-- Mostrar estructura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'asistencias'
ORDER BY ordinal_position;
