// Clave maestra del creador del proyecto (instructor). Sirve para volver a entrar como
// administrador aunque los aprendices creen sus propios administradores o reinicien el sitio.
//
// - La clave NO se guarda en el código ni en la base: solo su hash bcrypt, en el .env del
//   servidor (CLAVE_MAESTRA_HASH). Se genera con:  npm run maestra:hash
// - El usuario reservado (CLAVE_MAESTRA_USUARIO, por defecto "creador") no aparece en la lista
//   de usuarios, nadie lo puede crear, desactivar ni cambiarle la clave, y no cuenta para
//   "hay usuarios" (la configuración inicial sigue funcionando).
// - Sin CLAVE_MAESTRA_HASH la función queda apagada.
import bcrypt from 'bcryptjs';

export const usuarioMaestro = () => String(process.env.CLAVE_MAESTRA_USUARIO || 'creador').trim().toLowerCase();
const hashMaestro = () => String(process.env.CLAVE_MAESTRA_HASH || '').trim();
const NOMBRE = 'Creador del proyecto';

export const esMaestro = (usuario) => String(usuario ?? '').trim().toLowerCase() === usuarioMaestro();

// Devuelve { id, usuario, nombre, rol } si la clave maestra es correcta; si no, null.
// Asegura que exista la fila del creador (para que el historial pueda nombrarlo) y que sea
// administrador activo, aunque alguien la haya tocado directamente en la base.
export async function entrarComoMaestro(db, contrasena) {
  const hash = hashMaestro();
  if (!/^\$2[aby]\$\d{2}\$/.test(hash)) return null;
  if (!(await bcrypt.compare(String(contrasena ?? ''), hash))) return null;
  const u = usuarioMaestro();
  db.prepare(
    `INSERT INTO usuarios (usuario, nombre, hash, rol, activo) VALUES (?, ?, ?, 'admin', 1)
     ON CONFLICT(usuario) DO UPDATE SET hash = excluded.hash, rol = 'admin', activo = 1`,
  ).run(u, NOMBRE, hash);
  return db.prepare('SELECT id, usuario, nombre, rol FROM usuarios WHERE usuario = ?').get(u);
}
