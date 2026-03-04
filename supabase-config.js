// CONFIGURACIÓN DE SUPABASE
// Version: 1.1.0-20260119
console.log('🔧 Cargando configuración de Supabase...');

const SUPABASE_CONFIG = {
  // URL de tu proyecto Supabase
  url: 'https://bhjgcpjsjofuohacyise.supabase.co',
  
  // Clave anon/public (segura para usar en el cliente)
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoamdjcGpzam9mdW9oYWN5aXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNjI4MDksImV4cCI6MjA3NzkzODgwOX0.ki4Ss9vYQUEYcvT3-rHl5d5ghL71oTL9mOMzetBwhEw'
};

// Inicializar cliente de Supabase como variable GLOBAL
window.supabaseClient = null;

// Esperar a que Supabase esté disponible
if (typeof supabase !== 'undefined') {
  window.supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  console.log('✅ Supabase conectado:', SUPABASE_CONFIG.url);
  console.log('🔑 Cliente inicializado correctamente');
} else {
  console.error('❌ Supabase library no cargada. Verifica que el script CDN esté antes de este archivo.');
}

// Verificar conexión
if (window.supabaseClient) {
  console.log('🧪 Probando conexión a Supabase...');
  window.supabaseClient.from('productos').select('id').limit(1).then(({ data, error }) => {
    if (error) {
      console.error('❌ Error de conexión:', error.message);
    } else {
      console.log('✅ Conexión exitosa a Supabase');
    }
  });
}
