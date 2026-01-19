-- =============================================
-- PARTE 2: ALIMENTOS SUPER PREMIUM
-- Purina, Bravery, Josera, Belcando, Leonardo, Vet Life, N&D, Brit Care, Chile Dog
-- =============================================

-- ========== PURINA - PROPLAN GATO ==========

-- Proplan Gato 1kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Proplan Kitten 1kg', 'Proplan', 'Super Premium Gato', 'saco', 0, 0, 2, 'Purina'),
('Proplan Urinary 1kg', 'Proplan', 'Super Premium Gato', 'saco', 0, 0, 2, 'Purina'),
('Proplan Sterilized 1kg', 'Proplan', 'Super Premium Gato', 'saco', 0, 0, 2, 'Purina');

-- Proplan Gato 3kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Proplan Sterilized 3kg', 'Proplan', 'Super Premium Gato', 'saco', 0, 2, 2, 'Purina'),
('Proplan Kitten 3kg', 'Proplan', 'Super Premium Gato', 'saco', 0, 1, 2, 'Purina'),
('Proplan Adulto 3kg', 'Proplan', 'Super Premium Gato', 'saco', 0, 0, 2, 'Purina'),
('Proplan Urinary 3kg', 'Proplan', 'Super Premium Gato', 'saco', 0, 2, 2, 'Purina'),
('Proplan Senior 3kg', 'Proplan', 'Super Premium Gato', 'saco', 0, 0, 2, 'Purina');

-- Proplan Gato 7.5kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Proplan Kitten 7.5kg', 'Proplan', 'Super Premium Gato', 'saco', 0, 1, 2, 'Purina'),
('Proplan Urinary 7.5kg', 'Proplan', 'Super Premium Gato', 'saco', 0, 0, 2, 'Purina'),
('Proplan Adulto 7.5kg', 'Proplan', 'Super Premium Gato', 'saco', 0, 0, 2, 'Purina'),
('Proplan Sterilized 7.5kg', 'Proplan', 'Super Premium Gato', 'saco', 0, 2, 2, 'Purina');

-- ========== PURINA - EXCELLENT GATO ==========

INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Excellent Adulto 3kg', 'Excellent', 'Super Premium Gato', 'saco', 0, 0, 2, 'Purina'),
('Excellent Urinary 1kg', 'Excellent', 'Super Premium Gato', 'saco', 0, 0, 2, 'Purina'),
('Excellent Kitten 7.5kg', 'Excellent', 'Super Premium Gato', 'saco', 0, 1, 2, 'Purina'),
('Excellent Urinary 7.5kg', 'Excellent', 'Super Premium Gato', 'saco', 0, 0, 2, 'Purina'),
('Excellent Sterilized 7.5kg', 'Excellent', 'Super Premium Gato', 'saco', 0, 0, 2, 'Purina'),
('Excellent Adultos 7.5kg', 'Excellent', 'Super Premium Gato', 'saco', 0, 0, 2, 'Purina');

-- ========== PURINA - CAT CHOW ==========

-- Cat Chow 8kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Cat Chow Gatitos 8kg', 'Cat Chow', 'Gatito', 'saco', 0, 0, 2, 'Purina'),
('Cat Chow Delimix 8kg', 'Cat Chow', 'Gato Adulto', 'saco', 0, 0, 2, 'Purina'),
('Cat Chow Carne 8kg', 'Cat Chow', 'Gato Adulto', 'saco', 0, 0, 2, 'Purina'),
('Cat Chow Pescado 8kg', 'Cat Chow', 'Gato Adulto', 'saco', 0, 0, 2, 'Purina'),
('Cat Chow Hogareño 8kg', 'Cat Chow', 'Gato Adulto', 'saco', 0, 0, 2, 'Purina'),
('Cat Chow Esterilizado 8kg', 'Cat Chow', 'Gato Esterilizado', 'saco', 0, 0, 2, 'Purina');

-- Cat Chow 19.5kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Cat Chow Gatitos 19.5kg', 'Cat Chow', 'Gatito', 'saco', 0, 1, 2, 'Purina'),
('Cat Chow Delimix 19.5kg', 'Cat Chow', 'Gato Adulto', 'saco', 0, 1, 2, 'Purina'),
('Cat Chow Carne 19.5kg', 'Cat Chow', 'Gato Adulto', 'saco', 0, 1, 2, 'Purina'),
('Cat Chow Pescado 19.5kg', 'Cat Chow', 'Gato Adulto', 'saco', 0, 0, 2, 'Purina'),
('Cat Chow Esterilizado 19.5kg', 'Cat Chow', 'Gato Esterilizado', 'saco', 0, 0, 2, 'Purina');

-- ========== PURINA - GATTI ==========

INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Gatti Pescado 15kg', 'Gatti', 'Gato Adulto', 'saco', 0, 0, 2, 'Purina'),
('Gatti Carne 15kg', 'Gatti', 'Gato Adulto', 'saco', 0, 0, 2, 'Purina'),
('Gatti Pescado 8kg', 'Gatti', 'Gato Adulto', 'saco', 0, 0, 2, 'Purina');

-- ========== PURINA - VETERINARY DIETS GATO ==========

-- Veterinary Diets Gato 1.5kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Proplan Veterinary Hidrolized HA 1.5kg Gato', 'Proplan Veterinary', 'Veterinario Gato', 'saco', 0, 0, 1, 'Purina'),
('Proplan Veterinary Kidney Function NF Early Care 1.5kg Gato', 'Proplan Veterinary', 'Veterinario Gato', 'saco', 0, 0, 1, 'Purina'),
('Proplan Veterinary Kidney Function NF Advanced Care 1.5kg Gato', 'Proplan Veterinary', 'Veterinario Gato', 'saco', 0, 0, 1, 'Purina'),
('Proplan Veterinary Overweight OM 1.5kg Gato', 'Proplan Veterinary', 'Veterinario Gato', 'saco', 0, 0, 1, 'Purina'),
('Proplan Veterinary Urinary UR 1.5kg Gato', 'Proplan Veterinary', 'Veterinario Gato', 'saco', 0, 0, 1, 'Purina'),
('Proplan Veterinary Gastroenteric EN 1.5kg Gato', 'Proplan Veterinary', 'Veterinario Gato', 'saco', 0, 0, 1, 'Purina');

-- Veterinary Diets Gato 3kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Proplan Veterinary Hidrolized 3kg Gato', 'Proplan Veterinary', 'Veterinario Gato', 'saco', 0, 0, 1, 'Purina');

-- ========== PURINA - FÉLIX ==========

INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Félix Megamix Adulto 15kg', 'Félix', 'Gato Adulto', 'saco', 0, 0, 2, 'Purina'),
('Félix Megamix Gatitos 15kg', 'Félix', 'Gatito', 'saco', 0, 0, 2, 'Purina'),
('Félix Megamix Adulto 7kg', 'Félix', 'Gato Adulto', 'saco', 0, 0, 2, 'Purina'),
('Félix Megamix Gatitos 7kg', 'Félix', 'Gatito', 'saco', 0, 0, 2, 'Purina');

-- ========== PURINA - PROPLAN PERRO ==========

-- Proplan Perro 1kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Proplan Puppy RP 1kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 0, 2, 'Purina');

-- Proplan Perro 3kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Proplan Puppy RP 3kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 2, 2, 'Purina'),
('Proplan Adult RP 3kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 1, 2, 'Purina'),
('Proplan Reduce Calorie 3kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 0, 2, 'Purina'),
('Proplan Active Mind 3kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 0, 2, 'Purina'),
('Proplan Sensitive RP 3kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 0, 2, 'Purina');

-- Proplan Perro 7.5kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Proplan Puppy RP 7.5kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 2, 2, 'Purina'),
('Proplan Adult RP 7.5kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 1, 2, 'Purina'),
('Proplan Reduce Calorie 7.5kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 0, 2, 'Purina'),
('Proplan Active Mind 7.5kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 0, 2, 'Purina');

-- Proplan Perro 12-15kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Proplan Puppy RG 12kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 0, 2, 'Purina'),
('Proplan Puppy RG 15kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 0, 2, 'Purina'),
('Proplan Puppy RM 12kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 1, 2, 'Purina'),
('Proplan Adult RG 12kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 0, 2, 'Purina'),
('Proplan Adult RM 12kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 2, 2, 'Purina'),
('Proplan Reduced Calorie 12kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 0, 2, 'Purina'),
('Proplan Sensitive Salmón 12kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 0, 2, 'Purina'),
('Proplan Sensitive Cordero 12kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 0, 2, 'Purina'),
('Proplan Active Mind 15kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 0, 2, 'Purina'),
('Proplan Senior 12kg', 'Proplan', 'Super Premium Perro', 'saco', 0, 0, 2, 'Purina');

-- ========== PURINA - VETERINARY DIETS PERRO ==========

-- Veterinary Diets Perro 2kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Proplan Veterinary Cardiocare NF Renal Functions 2kg', 'Proplan Veterinary', 'Veterinario Perro', 'saco', 0, 0, 1, 'Purina');

-- Veterinary Diets Perro 7.5kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Proplan Veterinary Cardiocare CC 7.5kg', 'Proplan Veterinary', 'Veterinario Perro', 'saco', 0, 0, 1, 'Purina'),
('Proplan Veterinary Joint Mobility JM 7.5kg', 'Proplan Veterinary', 'Veterinario Perro', 'saco', 0, 0, 1, 'Purina'),
('Proplan Veterinary Overweight OM 7.5kg Perro', 'Proplan Veterinary', 'Veterinario Perro', 'saco', 0, 0, 1, 'Purina'),
('Proplan Veterinary Urinary UR 7.5kg Perro', 'Proplan Veterinary', 'Veterinario Perro', 'saco', 0, 0, 1, 'Purina'),
('Proplan Veterinary Hidrolized HA 7.5kg Perro', 'Proplan Veterinary', 'Veterinario Perro', 'saco', 0, 0, 1, 'Purina'),
('Proplan Veterinary Gastrointestinal EN 7.5kg', 'Proplan Veterinary', 'Veterinario Perro', 'saco', 0, 1, 1, 'Purina');

-- ========== PURINA - DOG CHOW ==========

INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Dog Chow Cachorro MG 16.5kg', 'Dog Chow', 'Cachorro', 'saco', 0, 0, 2, 'Purina'),
('Dog Chow Adulto RP 19.5kg', 'Dog Chow', 'Adulto Raza Pequeña', 'saco', 0, 0, 2, 'Purina'),
('Dog Chow Cachorro MP 19.5kg', 'Dog Chow', 'Cachorro', 'saco', 0, 2, 2, 'Purina'),
('Dog Chow Adulto RP 18kg', 'Dog Chow', 'Adulto Raza Pequeña', 'saco', 0, 0, 2, 'Purina'),
('Dog Chow Adulto RM 16.5kg', 'Dog Chow', 'Adulto', 'saco', 0, 0, 2, 'Purina'),
('Dog Chow Control Peso 15kg', 'Dog Chow', 'Light', 'saco', 0, 0, 2, 'Purina'),
('Dog Chow Longevidad 16.5kg', 'Dog Chow', 'Senior', 'saco', 0, 0, 2, 'Purina'),
('Dog Chow Longevidad 18kg', 'Dog Chow', 'Senior', 'saco', 0, 0, 2, 'Purina'),
('Dog Chow Cachorros MP 8kg', 'Dog Chow', 'Cachorro', 'saco', 0, 0, 2, 'Purina');

-- ========== PURINA - DOKO ==========

INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Doko Cachorro 18kg', 'Doko', 'Cachorro', 'saco', 0, 0, 2, 'Purina'),
('Doko Adulto 18kg', 'Doko', 'Adulto', 'saco', 0, 0, 2, 'Purina');

-- ========== BRAVERY - GATO ==========

-- Bravery Gato 2kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Bravery Salmón Cat Adulto Sterilizado 2kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 1, 1, 'Bravery'),
('Bravery Pollo Cat Adulto Sterilizado 2kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 1, 1, 'Bravery'),
('Bravery Herring Cat Adulto Sterilizado 2kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Salmón Adulto Cat 2kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 1, 1, 'Bravery'),
('Bravery Chicken Kitten 2kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Salmón Kitten 2kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Chicken Adulto Cat 2kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Herring Adulto Cat 2kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Herring Adulto Cat +8 2kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 0, 1, 'Bravery');

-- Bravery Gato 7kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Bravery Chicken Adulto Cat 7kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Salmón Adulto Cat 7kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Herring Adulto Cat 7kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Chicken Adulto Esterilizado Cat 7kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Salmón Cat Adulto Sterilizado 7kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Herring Cat Adulto Sterilized 7kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Herring Cat Adulto +8 7kg', 'Bravery', 'Super Premium Gato', 'saco', 0, 0, 1, 'Bravery');

-- ========== BRAVERY - PERRO ==========

-- Bravery Perro 2kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Bravery Salmón Mini Adult Small Breeds 2kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 1, 1, 'Bravery'),
('Bravery Iberian Pork Mini Adult Small Breeds 2kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Lamb Mini Adult Small Breeds 2kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Chicken Mini Adult Small Breeds 2kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 2, 1, 'Bravery'),
('Bravery Herring Mini Adult Small Breeds 2kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Chicken Mini Puppy Small Breeds 2kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 3, 1, 'Bravery'),
('Bravery Salmón Mini Puppy Small Breeds 2kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 3, 1, 'Bravery'),
('Bravery Herring Mini Adult Senior Small Breeds 2kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery');

-- Bravery Perro 7kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Bravery Chicken Mini Puppy Small Breeds 7kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Salmón Mini Puppy Small Breeds 7kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Chicken Mini Adult Small Breeds 7kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 2, 1, 'Bravery'),
('Bravery Iberian Pork Mini Adult Small Breeds 7kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Lamb Mini Adult Small Breeds 7kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Salmón Mini Adult Small Breed 7kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Salmón Adulto Large Medium Breeds 7kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery');

-- Bravery Perro 12kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Bravery Chicken Adulto Large Medium Breeds 12kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Iberian Pork Adult Large Medium Breeds 12kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Lamb Adult Large Medium Breeds 12kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Salmon Adulto Large Medium Breeds 12kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Herring Adulto Senior Large Medium Breeds 12kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Salmon Puppy Large Medium Breed 12kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Bravery Pollo Puppy Large Medium Breed 12kg', 'Bravery', 'Super Premium Perro', 'saco', 0, 1, 1, 'Bravery');

-- Bravery Amity
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Amity Puppy 14kg', 'Amity', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Amity Adulto Salmón 14kg', 'Amity', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery'),
('Amity Adulto Pollo 14kg', 'Amity', 'Super Premium Perro', 'saco', 0, 0, 1, 'Bravery');

-- ========== JOSERA - PERRO ==========

INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Bávaro Task 18kg', 'Josera', 'Super Premium Perro', 'saco', 0, 0, 1, 'Josera'),
('Bávaro Work 18kg', 'Josera', 'Super Premium Perro', 'saco', 0, 0, 1, 'Josera'),
('Bávaro Force 18kg', 'Josera', 'Super Premium Perro', 'saco', 0, 1, 1, 'Josera'),
('Josidog Regular 18kg', 'Josera', 'Super Premium Perro', 'saco', 0, 2, 1, 'Josera'),
('Josidog Junior 18kg', 'Josera', 'Super Premium Perro', 'saco', 0, 1, 1, 'Josera'),
('Josidog Active 18kg', 'Josera', 'Super Premium Perro', 'saco', 0, 1, 1, 'Josera'),
('Josidog Solido 18kg', 'Josera', 'Super Premium Perro', 'saco', 0, 0, 1, 'Josera');

INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Josera Kids 15kg', 'Josera', 'Super Premium Perro', 'saco', 0, 0, 1, 'Josera'),
('Josera Festival 12.5kg', 'Josera', 'Super Premium Perro', 'saco', 0, 1, 1, 'Josera'),
('Josera Fiesta Plus 12.5kg', 'Josera', 'Super Premium Perro', 'saco', 0, 1, 1, 'Josera'),
('Josera Miniwell 10kg', 'Josera', 'Super Premium Perro', 'saco', 0, 1, 1, 'Josera'),
('Josera Ente & Kartoffel 12.5kg', 'Josera', 'Super Premium Perro', 'saco', 0, 0, 1, 'Josera'),
('Josera Lachs & Kartoffel 12.5kg', 'Josera', 'Super Premium Perro', 'saco', 0, 2, 1, 'Josera'),
('Josera Balance 12.5kg', 'Josera', 'Super Premium Perro', 'saco', 0, 0, 1, 'Josera');

-- ========== JOSERA - GATO ==========

-- Josera Gato 2kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Josera Marinese 2kg', 'Josera', 'Super Premium Gato', 'saco', 0, 0, 1, 'Josera'),
('Josera Naturelle 2kg', 'Josera', 'Super Premium Gato', 'saco', 0, 0, 1, 'Josera'),
('Josera Naturecat 2kg', 'Josera', 'Super Premium Gato', 'saco', 0, 1, 1, 'Josera'),
('Josera Daily Cat 2kg', 'Josera', 'Super Premium Gato', 'saco', 0, 0, 1, 'Josera'),
('Josera Kitten Cat 2kg', 'Josera', 'Super Premium Gato', 'saco', 0, 0, 1, 'Josera'),
('Josera Culinesse Cat 2kg', 'Josera', 'Super Premium Gato', 'saco', 0, 0, 1, 'Josera');

-- Josera Gato 10kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Josera Marinese 10kg', 'Josera', 'Super Premium Gato', 'saco', 0, 0, 1, 'Josera'),
('Josera Naturelle 10kg', 'Josera', 'Super Premium Gato', 'saco', 0, 0, 1, 'Josera'),
('Josera Naturecat 10kg', 'Josera', 'Super Premium Gato', 'saco', 0, 1, 1, 'Josera'),
('Josera Daily Cat 10kg', 'Josera', 'Super Premium Gato', 'saco', 0, 1, 1, 'Josera'),
('Josera Culinesse 10kg', 'Josera', 'Super Premium Gato', 'saco', 0, 0, 1, 'Josera');

INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Josicat Pollo 10kg', 'Josera', 'Super Premium Gato', 'saco', 0, 0, 1, 'Josera'),
('Josicat Pato 10kg', 'Josera', 'Super Premium Gato', 'saco', 0, 0, 1, 'Josera');

-- ========== BELCANDO - PERRO ==========

INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Belcando Adulto Ibérico Rice 12.5kg', 'Belcando', 'Super Premium Perro', 'saco', 0, 0, 1, 'Belcando'),
('Belcando Adulto Active 12.5kg', 'Belcando', 'Super Premium Perro', 'saco', 0, 1, 1, 'Belcando'),
('Belcando Finest Croc 12.5kg', 'Belcando', 'Super Premium Perro', 'saco', 0, 0, 1, 'Belcando'),
('Belcando Finest Salmón 12.5kg', 'Belcando', 'Super Premium Perro', 'saco', 0, 0, 1, 'Belcando'),
('Belcando Finest Senior 12.5kg', 'Belcando', 'Super Premium Perro', 'saco', 0, 1, 1, 'Belcando'),
('Belcando Finest Light 12.5kg', 'Belcando', 'Super Premium Perro', 'saco', 0, 0, 1, 'Belcando'),
('Belcando Puppy Gravy 12.5kg', 'Belcando', 'Super Premium Perro', 'saco', 0, 1, 1, 'Belcando');

-- ========== LEONARDO - GATO ==========

-- Leonardo 1.8-2kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Leonardo Adulto GF Salmón 1.8kg', 'Leonardo', 'Super Premium Gato', 'saco', 0, 1, 1, 'Leonardo'),
('Leonardo Senior 2kg', 'Leonardo', 'Super Premium Gato', 'saco', 0, 0, 1, 'Leonardo'),
('Leonardo Adulto Pato 2kg', 'Leonardo', 'Super Premium Gato', 'saco', 0, 2, 1, 'Leonardo'),
('Leonardo Kitten 1.8kg', 'Leonardo', 'Super Premium Gato', 'saco', 0, 1, 1, 'Leonardo'),
('Leonardo Salmón 1.8kg', 'Leonardo', 'Super Premium Gato', 'saco', 0, 0, 1, 'Leonardo');

-- Leonardo 7.5kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Leonardo Kitten 7.5kg', 'Leonardo', 'Super Premium Gato', 'saco', 0, 0, 1, 'Leonardo'),
('Leonardo Adulto Duck 7.5kg', 'Leonardo', 'Super Premium Gato', 'saco', 0, 1, 1, 'Leonardo'),
('Leonardo Adulto Light 7.5kg', 'Leonardo', 'Super Premium Gato', 'saco', 0, 0, 1, 'Leonardo'),
('Leonardo Adulto Senior 7.5kg', 'Leonardo', 'Super Premium Gato', 'saco', 0, 0, 1, 'Leonardo'),
('Leonardo Adulto Salmón 7.5kg', 'Leonardo', 'Super Premium Gato', 'saco', 0, 2, 1, 'Leonardo');

-- ========== VET LIFE - GATO ==========

INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Vet Life Renal 2kg Gato', 'Vet Life', 'Veterinario Gato', 'saco', 0, 0, 1, 'Vet Life'),
('Vet Life Urinary Struvite 2kg Gato', 'Vet Life', 'Veterinario Gato', 'saco', 0, 1, 1, 'Vet Life'),
('Vet Life Gastro-Intestinal 2kg Gato', 'Vet Life', 'Veterinario Gato', 'saco', 0, 0, 1, 'Vet Life'),
('Vet Life Obesity 2kg Gato', 'Vet Life', 'Veterinario Gato', 'saco', 0, 0, 1, 'Vet Life'),
('Vet Life Diabetic 2kg Gato', 'Vet Life', 'Veterinario Gato', 'saco', 0, 0, 1, 'Vet Life');

-- ========== VET LIFE - PERRO ==========

-- Vet Life Perro 2kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Vet Life Renal 2kg Perro', 'Vet Life', 'Veterinario Perro', 'saco', 0, 1, 1, 'Vet Life'),
('Vet Life Urinary Struvite 2kg Perro', 'Vet Life', 'Veterinario Perro', 'saco', 0, 2, 1, 'Vet Life'),
('Vet Life Gastro-Intestinal 2kg Perro', 'Vet Life', 'Veterinario Perro', 'saco', 0, 2, 1, 'Vet Life'),
('Vet Life Hypoallergenic 2kg', 'Vet Life', 'Veterinario Perro', 'saco', 0, 0, 1, 'Vet Life'),
('Vet Life Hepatic 2kg', 'Vet Life', 'Veterinario Perro', 'saco', 0, 0, 1, 'Vet Life'),
('Vet Life Obesity Et Diabetic 2kg', 'Vet Life', 'Veterinario Perro', 'saco', 0, 0, 1, 'Vet Life'),
('Vet Life Diabetic 2kg Perro', 'Vet Life', 'Veterinario Perro', 'saco', 0, 0, 1, 'Vet Life');

-- Vet Life Perro 10kg
INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('Vet Life Obesity Et Diabetic 10kg', 'Vet Life', 'Veterinario Perro', 'saco', 0, 0, 1, 'Vet Life'),
('Vet Life Hypoallergenic 10kg', 'Vet Life', 'Veterinario Perro', 'saco', 0, 0, 1, 'Vet Life'),
('Vet Life Renal 10kg', 'Vet Life', 'Veterinario Perro', 'saco', 0, 1, 1, 'Vet Life'),
('Vet Life Urinary 10kg', 'Vet Life', 'Veterinario Perro', 'saco', 0, 0, 1, 'Vet Life'),
('Vet Life Hepatic 10kg', 'Vet Life', 'Veterinario Perro', 'saco', 0, 1, 1, 'Vet Life');

-- ========== N&D (NATURAL & DELICIOUS) - GATO ==========

INSERT INTO productos (nombre, marca, categoria, tipo, precio, stock, stock_minimo, proveedor) VALUES
('N&D Adult Cat Pollo 1.5kg', 'N&D', 'Super Premium Gato', 'saco', 0, 0, 1, 'N&D'),
('N&D Adult Cat Pato 1.5kg', 'N&D', 'Super Premium Gato', 'saco', 0, 0, 1, 'N&D'),
('N&D Kitten Pollo Granada 1.5kg', 'N&D', 'Super Premium Gato', 'saco', 0, 0, 1, 'N&D'),
('N&D Kitten 7.5kg', 'N&D', 'Super Premium Gato', 'saco', 0, 0, 1, 'N&D'),
('N&D Skin Coat 7.5kg', 'N&D', 'Super Premium Gato', 'saco', 0, 0, 1, 'N&D'),
('N&D Adult Cat 7.5kg', 'N&D', 'Super Premium Gato', 'saco', 0, 0, 1, 'N&D'),
('N&D Castrados 7.5kg', 'N&D', 'Super Premium Gato', 'saco', 0, 0, 1, 'N&D'),
('N&D Ocean Formula 7.5kg', 'N&D', 'Super Premium Gato', 'saco', 0, 0, 1, 'N&D');

-- =============================================
-- ✅ PARTE 2 COMPLETADA
-- Alimentos Super Premium cargados exitosamente
-- =============================================
