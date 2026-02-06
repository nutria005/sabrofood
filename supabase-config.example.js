// ⚠️ PLANTILLA DE CONFIGURACIÓN
// Copia este archivo como "supabase-config.js" y reemplaza con tus credenciales reales

const SUPABASE_CONFIG = {
    url: 'https://TU-PROYECTO.supabase.co',
    anonKey: 'TU_CLAVE_ANON_AQUI'
};

// Inicializar cliente de Supabase
if (typeof supabase === 'undefined') {
    console.error('❌ La librería de Supabase no está cargada');
} else {
    const supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    console.log('✅ Cliente Supabase inicializado');
}
