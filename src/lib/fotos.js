// Fotos de las piezas (CLAUDE.md §3, §10.1): máx. 8 MB, solo imágenes; se guardan en WebP de 1200 px.
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';

export const TAMANO_MAXIMO = 8 * 1024 * 1024;

export const subidaFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO, files: 1, fields: 40 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
}).single('foto');

// Convierte y guarda. Devuelve el nombre del archivo, o lanza FOTO_INVALIDA si no es una imagen real.
export async function guardarFoto(buffer, id, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const nombre = `${id}-${Date.now()}.webp`;
  try {
    await sharp(buffer, { failOn: 'error' })
      .rotate() // respeta la orientación de la cámara del celular
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(dir, nombre));
  } catch {
    throw new Error('FOTO_INVALIDA');
  }
  return nombre;
}

export function borrarFoto(nombre, dir) {
  if (!nombre || !/^RAEE-\d{4}-\d+\.webp$/.test(nombre)) return;
  fs.rm(path.join(dir, nombre), { force: true }, () => {});
}
