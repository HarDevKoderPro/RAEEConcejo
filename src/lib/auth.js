// Usuarios y control de acceso (CLAUDE.md §10.1): consultar es público, editar exige sesión.
import bcrypt from 'bcryptjs';

export const COSTO_BCRYPT = 12;

export function crearUsuario(db, { usuario, nombre, contrasena, rol = 'editor' }, costo = COSTO_BCRYPT) {
  const u = String(usuario ?? '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new Error('El usuario debe tener de 3 a 30 letras, números, punto, guion o guion bajo.');
  if (!String(nombre ?? '').trim()) throw new Error('Escribe el nombre de la persona.');
  if (String(contrasena ?? '').length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  if (!['admin', 'editor'].includes(rol)) throw new Error('El rol debe ser admin o editor.');
  const hash = bcrypt.hashSync(String(contrasena), costo);
  db.prepare('INSERT INTO usuarios (usuario, nombre, hash, rol) VALUES (?, ?, ?, ?)').run(u, String(nombre).trim(), hash, rol);
  return u;
}

// Devuelve { id, usuario, nombre, rol } o null. Compara siempre, aunque el usuario no exista,
// para no delatar por el tiempo de respuesta qué usuarios existen.
const HASH_FALSO = bcrypt.hashSync('contrasena-que-no-existe', COSTO_BCRYPT);
export async function verificarCredenciales(db, usuario, contrasena) {
  const fila = db
    .prepare('SELECT id, usuario, nombre, rol, hash FROM usuarios WHERE usuario = ?')
    .get(String(usuario ?? '').trim().toLowerCase());
  const ok = await bcrypt.compare(String(contrasena ?? ''), fila?.hash ?? HASH_FALSO);
  if (!fila || !ok) return null;
  const { hash, ...publico } = fila;
  return publico;
}

// Solo rutas internas: evita redirecciones abiertas a otros sitios.
export function destinoSeguro(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\') ? url : '/';
}

export function requiereEditor(req, res, next) {
  if (req.session?.usuario) return next();
  if (req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ resultado: 'error', mensaje: 'Inicia sesión para hacer cambios.' });
  }
  res.redirect(303, `/entrar?siguiente=${encodeURIComponent(req.originalUrl)}`);
}

// Solo administradores (/admin). Un editor con sesión recibe un 403 amable.
export function requiereAdmin(req, res, next) {
  if (!req.session?.usuario) return requiereEditor(req, res, next);
  if (req.session.usuario.rol === 'admin') return next();
  res.status(403).render('error', {
    titulo: 'Solo administradores',
    icono: '🔒',
    mensaje: 'Esta sección es solo para administradores. Pídele a un administrador que haga este cambio.',
  });
}
