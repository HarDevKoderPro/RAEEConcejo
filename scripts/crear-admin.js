// Crea un usuario para editar. La contraseña se escribe en la consola y no se muestra.
//   npm run admin:crear
//   En el VPS:  docker exec -it raee-app-1 npm run admin:crear
import readline from 'node:readline';
import fs from 'node:fs';
import { config } from '../src/config.js';
import { abrirDb, aplicarEsquema } from '../src/db.js';
import { crearUsuario } from '../src/lib/auth.js';

if (!fs.existsSync(config.dbPath)) {
  console.error(`No existe la base ${config.dbPath}. Créala primero con: npm run db:seed`);
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const preguntar = (texto) => new Promise((ok) => rl.question(texto, (r) => ok(r.trim())));

// Pregunta sin mostrar lo que se escribe.
function preguntarOculto(texto) {
  return new Promise((ok) => {
    const escribirOriginal = rl._writeToOutput;
    rl._writeToOutput = (s) => {
      if (s.includes(texto)) escribirOriginal.call(rl, s);
      else escribirOriginal.call(rl, s.replace(/[^\r\n]/g, '*'));
    };
    rl.question(texto, (r) => {
      rl._writeToOutput = escribirOriginal;
      process.stdout.write('\n');
      ok(r);
    });
  });
}

const db = abrirDb(config.dbPath);
aplicarEsquema(db);
try {
  console.log('Nuevo usuario del Inventario RAEE\n');
  const usuario = await preguntar('Usuario (ej.: instructor): ');
  const nombre = await preguntar('Nombre para mostrar (ej.: Instructor Juan): ');
  const rol = (await preguntar('Rol [editor/admin] (editor): ')) || 'editor';
  const contrasena = await preguntarOculto('Contraseña (mín. 8 caracteres): ');
  const repetida = await preguntarOculto('Repite la contraseña: ');
  if (contrasena !== repetida) throw new Error('Las contraseñas no coinciden.');
  const creado = crearUsuario(db, { usuario, nombre, contrasena, rol });
  console.log(`\n✔ Usuario "${creado}" creado con rol ${rol}. Ya puede entrar en /entrar.`);
} catch (err) {
  const msg = /UNIQUE/.test(err.message) ? 'Ese usuario ya existe.' : err.message;
  console.error(`\n✖ ${msg}`);
  process.exitCode = 1;
} finally {
  rl.close();
  db.close();
}
