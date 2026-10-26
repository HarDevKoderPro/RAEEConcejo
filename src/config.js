// Configuración leída del entorno. Se importa primero para que .env quede cargado
// antes de abrir la base (la zona horaria TZ afecta las fechas 'localtime' de SQLite).
try {
  process.loadEnvFile();
} catch {
  // Sin .env se usan los valores por defecto.
}

const env = process.env;

export const config = {
  puerto: Number(env.PORT) || 3100,
  baseUrl: (env.BASE_URL || 'http://localhost:3100').replace(/\/+$/, ''),
  sessionSecret: env.SESSION_SECRET || '',
  dbPath: env.DB_PATH || './data/raee.db',
  fotosDir: env.FOTOS_DIR || './data/fotos',
  mostrarAvisoDemo: env.MOSTRAR_AVISO_DEMO !== 'false',
  produccion: env.NODE_ENV === 'production',
};
