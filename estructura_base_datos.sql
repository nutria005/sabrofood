-- =============================================
-- SISTEMA POS MASCOTAS - ESTRUCTURA DE BASE DE DATOS
-- Version 2.0 - Con campo proveedor y tipos ampliados
-- =============================================

-- TABLA: productos
-- Almacena todos los productos (sacos, granel, unidades, latas, sobres)
CREATE TABLE productos (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  marca TEXT,
  categoria TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('unidad', 'saco', 'granel', 'lata', 'sobre')),
  precio NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
  stock NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo NUMERIC(10,2) NOT NULL DEFAULT 0,
  peso_saco NUMERIC(10,2),
  id_granel BIGINT REFERENCES productos(id),
  proveedor TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar búsquedas
CREATE INDEX idx_productos_categoria ON productos(categoria);
CREATE INDEX idx_productos_tipo ON productos(tipo);
CREATE INDEX idx_productos_proveedor ON productos(proveedor);
CREATE INDEX idx_productos_nombre ON productos USING gin(to_tsvector('spanish', nombre));
CREATE INDEX idx_productos_marca ON productos USING gin(to_tsvector('spanish', marca));

-- =============================================

-- TABLA: ventas
-- Registro de cada venta realizada
CREATE TABLE ventas (
  id BIGSERIAL PRIMARY KEY,
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  vendedor_nombre TEXT NOT NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para consultas por fecha y vendedor
CREATE INDEX idx_ventas_fecha ON ventas(fecha DESC);
CREATE INDEX idx_ventas_vendedor ON ventas(vendedor_nombre);

-- =============================================

-- TABLA: ventas_items
-- Detalle de los productos vendidos en cada venta
CREATE TABLE ventas_items (
  id BIGSERIAL PRIMARY KEY,
  venta_id BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id BIGINT REFERENCES productos(id),
  producto_nombre TEXT NOT NULL,
  cantidad NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para consultas por venta
CREATE INDEX idx_ventas_items_venta ON ventas_items(venta_id);

-- =============================================

-- TABLA: ventas_pagos
-- Métodos de pago usados en cada venta (soporta pagos mixtos)
CREATE TABLE ventas_pagos (
  id BIGSERIAL PRIMARY KEY,
  venta_id BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  metodo TEXT NOT NULL CHECK (metodo IN ('Efectivo', 'Tarjeta', 'Transferencia')),
  monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para consultas por venta
CREATE INDEX idx_ventas_pagos_venta ON ventas_pagos(venta_id);

-- =============================================

-- TABLA: movimientos_stock
-- Historial de todos los cambios en el inventario
CREATE TABLE movimientos_stock (
  id BIGSERIAL PRIMARY KEY,
  producto_id BIGINT NOT NULL REFERENCES productos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('venta', 'ajuste', 'apertura_saco', 'ingreso')),
  cantidad NUMERIC(10,2) NOT NULL,
  stock_anterior NUMERIC(10,2) NOT NULL,
  stock_nuevo NUMERIC(10,2) NOT NULL,
  referencia_id BIGINT,
  observacion TEXT,
  usuario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para auditoría
CREATE INDEX idx_movimientos_producto ON movimientos_stock(producto_id);
CREATE INDEX idx_movimientos_fecha ON movimientos_stock(created_at DESC);

-- =============================================

-- FUNCIÓN: Actualizar timestamp automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para productos
CREATE TRIGGER productos_updated_at
BEFORE UPDATE ON productos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- =============================================

-- CONFIGURACIÓN DE SEGURIDAD (Row Level Security)

-- Habilitar RLS en todas las tablas
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

-- Políticas: Permitir lectura pública (para el POS)
CREATE POLICY "Permitir lectura pública de productos"
ON productos FOR SELECT
TO public
USING (activo = true);

CREATE POLICY "Permitir inserción pública de productos"
ON productos FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Permitir actualización pública de productos"
ON productos FOR UPDATE
TO public
USING (true);

CREATE POLICY "Permitir todo en ventas"
ON ventas FOR ALL
TO public
USING (true);

CREATE POLICY "Permitir todo en ventas_items"
ON ventas_items FOR ALL
TO public
USING (true);

CREATE POLICY "Permitir todo en ventas_pagos"
ON ventas_pagos FOR ALL
TO public
USING (true);

CREATE POLICY "Permitir todo en movimientos_stock"
ON movimientos_stock FOR ALL
TO public
USING (true);

-- =============================================
-- ✅ ESTRUCTURA DE BASE DE DATOS CREADA
-- =============================================
