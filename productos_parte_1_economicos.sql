-- =============================================
-- PARTE 1: ALIMENTOS ECONÓMICOS
-- Befoods, Master, Cruce, Argentino, Fit Formula, HR/AZ
-- =============================================

-- ========== BEFOODS ==========

-- Champion
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Champion Adulto 25kg', 'Champion', 'Adulto', 'saco', 0, 6, 3, 'Befoods'),
('Champion Adulto RP 15kg', 'Champion', 'Adulto Raza Pequeña', 'saco', 0, 2, 3, 'Befoods'),
('Champion Cachorro 25kg', 'Champion', 'Cachorro', 'saco', 0, 8, 3, 'Befoods'),
('Champion Senior 25kg', 'Champion', 'Senior', 'saco', 0, 2, 3, 'Befoods'),
('Champion Cachorro RP 8kg', 'Champion', 'Cachorro', 'saco', 0, 0, 3, 'Befoods');

-- Varios Befoods
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Cachupín 25kg', 'Cachupín', 'Adulto', 'saco', 0, 0, 3, 'Befoods'),
('Sabrokan 25kg', 'Sabrokan', 'Adulto', 'saco', 0, 3, 3, 'Befoods'),
('Maskocan 25kg', 'Maskocan', 'Adulto', 'saco', 0, 10, 3, 'Befoods'),
('Maskocat 25kg', 'Maskocat', 'Gato Adulto', 'saco', 0, 3, 3, 'Befoods');

-- Felinnes
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Felinnes Salmón 15kg', 'Felinnes', 'Gato Adulto', 'saco', 0, 0, 3, 'Befoods'),
('Felinnes Pollo 15kg', 'Felinnes', 'Gato Adulto', 'saco', 0, 0, 3, 'Befoods'),
('Felinnes Gatitos 15kg', 'Felinnes', 'Gatito', 'saco', 0, 2, 3, 'Befoods');

-- Special Cat
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Special Cat Mix 10kg', 'Special Cat', 'Gato Adulto', 'saco', 0, 3, 3, 'Befoods'),
('Special Cat Carne 10kg', 'Special Cat', 'Gato Adulto', 'saco', 0, 0, 3, 'Befoods'),
('Special Cat Pescado 10kg', 'Special Cat', 'Gato Adulto', 'saco', 0, 3, 3, 'Befoods'),
('Special Cat Gatitos 20kg', 'Special Cat', 'Gatito', 'saco', 0, 0, 3, 'Befoods'),
('Special Cat Mix 20kg', 'Special Cat', 'Gato Adulto', 'saco', 0, 0, 3, 'Befoods');

-- Special Dog
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Special Dog Adulto RP 10kg', 'Special Dog', 'Adulto Raza Pequeña', 'saco', 0, 1, 3, 'Befoods'),
('Special Dog Cachorro 10kg', 'Special Dog', 'Cachorro', 'saco', 0, 5, 3, 'Befoods'),
('Special Dog Adulto 20kg', 'Special Dog', 'Adulto', 'saco', 0, 0, 3, 'Befoods');

-- Whiskas
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Whiskas Carne 10kg', 'Whiskas', 'Gato Adulto', 'saco', 0, 0, 3, 'Befoods'),
('Whiskas Pollo 10kg', 'Whiskas', 'Gato Adulto', 'saco', 0, 0, 3, 'Befoods'),
('Whiskas Pescado 10kg', 'Whiskas', 'Gato Adulto', 'saco', 0, 0, 3, 'Befoods'),
('Whiskas Gatitos 10kg', 'Whiskas', 'Gatito', 'saco', 0, 0, 3, 'Befoods');

-- Pedigree
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Pedigree Adulto 21kg', 'Pedigree', 'Adulto', 'saco', 0, 0, 3, 'Befoods'),
('Pedigree Cachorro 21kg', 'Pedigree', 'Cachorro', 'saco', 0, 1, 3, 'Befoods'),
('Pedigree Adulto RP 15kg', 'Pedigree', 'Adulto Raza Pequeña', 'saco', 0, 1, 3, 'Befoods'),
('Pedigree Senior 21kg', 'Pedigree', 'Senior', 'saco', 0, 2, 3, 'Befoods');

-- Nomade
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Nomade Perro 20kg', 'Nomade', 'Adulto', 'saco', 0, 51, 5, 'Befoods'),
('Nomade Gato 10kg', 'Nomade', 'Gato Adulto', 'saco', 0, 3, 3, 'Befoods'),
('Nomade RP 10kg', 'Nomade', 'Adulto Raza Pequeña', 'saco', 0, 2, 3, 'Befoods'),
('Nomade Cachorro 20kg', 'Nomade', 'Cachorro', 'saco', 0, 3, 3, 'Befoods');

-- Cannes
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Cannes Adulto 20kg', 'Cannes', 'Adulto', 'saco', 0, 9, 3, 'Befoods'),
('Cannes Cachorro 20kg', 'Cannes', 'Cachorro', 'saco', 0, 3, 3, 'Befoods');

-- ========== MASTER ==========

-- Master Cat
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Master Cat Carne 15kg', 'Master Cat', 'Gato Adulto', 'saco', 0, 2, 3, 'Master'),
('Master Cat Pollo 15kg', 'Master Cat', 'Gato Adulto', 'saco', 0, 1, 3, 'Master'),
('Master Cat Salmón 15kg', 'Master Cat', 'Gato Adulto', 'saco', 0, 1, 3, 'Master');

-- Master Dog
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Master Dog Carne 22kg', 'Master Dog', 'Adulto', 'saco', 0, 0, 3, 'Master'),
('Master Dog Cachorro 22kg', 'Master Dog', 'Cachorro', 'saco', 0, 7, 3, 'Master'),
('Master Dog RP 15kg', 'Master Dog', 'Adulto Raza Pequeña', 'saco', 0, 4, 3, 'Master'),
('Master Dog Pollo 22kg', 'Master Dog', 'Adulto', 'saco', 0, 5, 3, 'Master'),
('Master Dog Senior 22kg', 'Master Dog', 'Senior', 'saco', 0, 7, 3, 'Master');

-- ========== CRUCE ==========

INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Canito 25kg', 'Canito', 'Adulto', 'saco', 0, 11, 3, 'Cruce'),
('Knino 25kg', 'Knino', 'Gato Adulto', 'saco', 0, 0, 3, 'Cruce'),
('Tyson 25kg', 'Tyson', 'Adulto', 'saco', 0, 16, 5, 'Cruce'),
('Dog Buffet 25kg', 'Dog Buffet', 'Adulto', 'saco', 0, 6, 3, 'Cruce'),
('Stark Can 25kg', 'Stark Can', 'Adulto', 'saco', 0, 5, 3, 'Cruce'),
('XT-21 25kg', 'XT-21', 'Adulto', 'saco', 0, 0, 3, 'Cruce'),
('Strong 25kg', 'Strong', 'Adulto', 'saco', 0, 0, 3, 'Cruce'),
('Mastin Adulto 22kg', 'Mastin', 'Adulto', 'saco', 0, 0, 3, 'Cruce'),
('Mastin Senior 22kg', 'Mastin', 'Senior', 'saco', 0, 0, 3, 'Cruce'),
('Raza Gato 15kg', 'Raza', 'Gato Adulto', 'saco', 0, 0, 3, 'Cruce'),
('Raza Gato 10kg', 'Raza', 'Gato Adulto', 'saco', 0, 2, 3, 'Cruce'),
('Bec 18kg', 'Bec', 'Adulto', 'saco', 0, 10, 3, 'Cruce'),
('Can Cachorro 18kg', 'Can', 'Cachorro', 'saco', 0, 4, 3, 'Cruce'),
('Can Adulto 18kg', 'Can', 'Adulto', 'saco', 0, 9, 3, 'Cruce');

-- Galletas
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Caja Galletas Can 10kg', 'Can', 'Snacks', 'unidad', 0, 0, 2, 'Cruce'),
('Caja Galletas Can 5kg', 'Can', 'Snacks', 'unidad', 0, 0, 2, 'Cruce'),
('Caja Galletas Dog Buffet 5kg', 'Dog Buffet', 'Snacks', 'unidad', 0, 0, 2, 'Cruce'),
('Caja Galletas Dog Buffet 10kg', 'Dog Buffet', 'Snacks', 'unidad', 0, 11, 2, 'Cruce');

-- Otros animales
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Saco Conejín 25kg', 'Varios', 'Otros', 'saco', 0, 2, 2, 'Cruce'),
('Saco Conejín 20kg', 'Varios', 'Otros', 'saco', 0, 0, 2, 'Cruce'),
('Saco Maíz Chancado 20kg', 'Varios', 'Otros', 'saco', 0, 2, 2, 'Cruce'),
('Saco Maíz Entero 25kg', 'Varios', 'Otros', 'saco', 0, 1, 2, 'Cruce'),
('Saco Alpiste 25kg', 'Varios', 'Otros', 'saco', 0, 0, 2, 'Cruce');

-- ========== ARGENTINO ==========

INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Ganacan 25kg', 'Ganacan', 'Adulto', 'saco', 0, 9, 3, 'Argentino'),
('Ganacat 10kg', 'Ganacat', 'Gato Adulto', 'saco', 0, 0, 3, 'Argentino'),
('Compinches 25kg', 'Compinches', 'Adulto', 'saco', 0, 9, 3, 'Argentino'),
('Odwalla Adulto 25kg', 'Odwalla', 'Adulto', 'saco', 0, 1, 3, 'Argentino'),
('Odwalla Cachorro 25kg', 'Odwalla', 'Cachorro', 'saco', 0, 3, 3, 'Argentino'),
('Odwalla Cachorro 15kg', 'Odwalla', 'Cachorro', 'saco', 0, 0, 3, 'Argentino'),
('Amici 22kg', 'Amici', 'Adulto', 'saco', 0, 6, 3, 'Argentino');

-- 9 Lives
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('9 Lives Carne 15kg', '9 Lives', 'Gato Adulto', 'saco', 0, 0, 3, 'Argentino'),
('9 Lives Salmón 15kg', '9 Lives', 'Gato Adulto', 'saco', 0, 0, 3, 'Argentino'),
('9 Lives Hogareños 15kg', '9 Lives', 'Gato Adulto', 'saco', 0, 0, 3, 'Argentino'),
('9 Lives Carne 8kg', '9 Lives', 'Gato Adulto', 'saco', 0, 0, 3, 'Argentino'),
('9 Lives Salmón 8kg', '9 Lives', 'Gato Adulto', 'saco', 0, 0, 3, 'Argentino'),
('9 Lives Kitten 8kg', '9 Lives', 'Gatito', 'saco', 0, 0, 3, 'Argentino'),
('9 Lives Hogareños 8kg', '9 Lives', 'Gato Adulto', 'saco', 0, 0, 3, 'Argentino');

-- ========== FIT FORMULA ==========

INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Fit Senior RP 10kg', 'Fit Formula', 'Senior', 'saco', 0, 13, 3, 'Fit Formula'),
('Fit Senior 20kg', 'Fit Formula', 'Senior', 'saco', 0, 0, 3, 'Fit Formula'),
('Fit Adulto 20kg', 'Fit Formula', 'Adulto', 'saco', 0, 8, 3, 'Fit Formula'),
('Fit Adulto Light 20kg', 'Fit Formula', 'Light', 'saco', 0, 6, 3, 'Fit Formula'),
('Fit Adulto RP 10kg', 'Fit Formula', 'Adulto Raza Pequeña', 'saco', 0, 3, 3, 'Fit Formula'),
('Fit Cachorro 10kg', 'Fit Formula', 'Cachorro', 'saco', 0, 7, 3, 'Fit Formula'),
('Fit Gato 10kg', 'Fit Formula', 'Gato Adulto', 'saco', 0, 8, 3, 'Fit Formula');

-- ========== HR Y AZ ==========

-- Astro
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Astro Perro Adulto 14kg', 'Astro', 'Adulto', 'saco', 0, 0, 3, 'HR/AZ'),
('Astro Perro Senior 14kg', 'Astro', 'Senior', 'saco', 0, 0, 3, 'HR/AZ'),
('Astro Gato Adulto 10kg', 'Astro', 'Gato Adulto', 'saco', 0, 0, 3, 'HR/AZ'),
('Astro Gato Adulto Sterilizado 7kg', 'Astro', 'Gato Esterilizado', 'saco', 0, 6, 3, 'HR/AZ');

-- Leroy
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Leroy 10.1kg Carne', 'Leroy', 'Adulto', 'saco', 0, 8, 3, 'HR/AZ'),
('Leroy 10.1kg Pollo', 'Leroy', 'Adulto', 'saco', 0, 24, 5, 'HR/AZ'),
('Leroy 15kg Carne', 'Leroy', 'Adulto', 'saco', 0, 4, 3, 'HR/AZ');

-- Atacama
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Atacama 20kg', 'Atacama', 'Adulto', 'saco', 0, 0, 3, 'HR/AZ'),
('Atacama Puppy 14kg', 'Atacama', 'Cachorro', 'saco', 0, 12, 3, 'HR/AZ'),
('Atacama 14kg', 'Atacama', 'Adulto', 'saco', 0, 13, 3, 'HR/AZ'),
('Atacama Gato 10kg', 'Atacama', 'Gato Adulto', 'saco', 0, 7, 3, 'HR/AZ');

-- Trotter
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Trotter Adulto 20kg', 'Trotter', 'Adulto', 'saco', 0, 3, 3, 'HR/AZ'),
('Trotter Cachorro 10kg', 'Trotter', 'Cachorro', 'saco', 0, 3, 3, 'HR/AZ'),
('Trotter Adulto RP 10kg', 'Trotter', 'Adulto Raza Pequeña', 'saco', 0, 4, 3, 'HR/AZ'),
('Trotter Gato 10kg', 'Trotter', 'Gato Adulto', 'saco', 0, 0, 3, 'HR/AZ');

-- Otros HR/AZ
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Tango 20kg', 'Tango', 'Adulto', 'saco', 0, 1, 3, 'HR/AZ'),
('Sapeca 20kg', 'Sapeca', 'Adulto', 'saco', 0, 0, 3, 'HR/AZ'),
('Nhock 20kg', 'Nhock', 'Adulto', 'saco', 0, 0, 3, 'HR/AZ');

-- Frost Perro
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Frost Adult LB 15kg', 'Frost', 'Adulto', 'saco', 0, 2, 3, 'HR/AZ'),
('Frost Puppy LB 15kg', 'Frost', 'Cachorro', 'saco', 0, 10, 3, 'HR/AZ'),
('Frost Senior 15kg', 'Frost', 'Senior', 'saco', 0, 2, 3, 'HR/AZ'),
('Frost Sensitive Skin 10kg', 'Frost', 'Adulto', 'saco', 0, 3, 3, 'HR/AZ'),
('Frost Puppy SB 10kg', 'Frost', 'Cachorro', 'saco', 0, 0, 3, 'HR/AZ'),
('Frost Sensitive Skin 2.5kg', 'Frost', 'Adulto Raza Pequeña', 'saco', 0, 0, 3, 'HR/AZ'),
('Frost Puppy SB 2.5kg', 'Frost', 'Cachorro', 'saco', 0, 0, 3, 'HR/AZ'),
('Frost Adulto Mini & Small 2.5kg', 'Frost', 'Adulto Raza Pequeña', 'saco', 0, 0, 3, 'HR/AZ');

-- Frost Gato
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Frost Cat Indoor Esterilizado 7.5kg', 'Frost', 'Gato Esterilizado', 'saco', 0, 6, 3, 'HR/AZ'),
('Frost Kitten 1.5kg', 'Frost', 'Gatito', 'saco', 0, 0, 3, 'HR/AZ'),
('Frost Cat Indoor Esterilizado 1.5kg', 'Frost', 'Gato Esterilizado', 'saco', 0, 0, 3, 'HR/AZ'),
('Frost Cat Senior 1.5kg', 'Frost', 'Gato Adulto', 'saco', 0, 0, 3, 'HR/AZ');

-- =============================================
-- ✅ PARTE 1 COMPLETADA
-- Productos económicos cargados exitosamente
-- =============================================
