// Genera el hash de la clave maestra del creador del proyecto (ver src/lib/maestra.js).
//   npm run maestra:hash
// Escribe la clave (no se muestra) o déjala vacía para que se genere una al azar.
// Imprime la línea que va en el .env del servidor. La clave en sí no se guarda en ninguna parte.
import readline from 'node:readline';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

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

try {
  console.log('Clave maestra del creador del proyecto\n');
  let clave = await preguntarOculto('Clave maestra (mín. 12 caracteres; vacío = generar una): ');
  let generada = false;
  if (!clave) {
    clave = crypto.randomBytes(18).toString('base64url');
    generada = true;
  } else {
    if (clave.length < 12) throw new Error('La clave maestra debe tener al menos 12 caracteres.');
    if (clave !== (await preguntarOculto('Repítela: '))) throw new Error('Las claves no coinciden.');
  }
  const hash = bcrypt.hashSync(clave, 12);
  if (generada) console.log(`\nClave generada (anótala ahora, no se vuelve a mostrar):\n\n    ${clave}\n`);
  console.log('Agrega estas líneas al .env del servidor (con las comillas simples) y reinicia la app:\n');
  console.log('CLAVE_MAESTRA_USUARIO=creador');
  console.log(`CLAVE_MAESTRA_HASH='${hash}'\n`);
  console.log('Para entrar: /entrar?creador=1 con el usuario «creador» y la clave maestra.');
} catch (err) {
  console.error(`\n✖ ${err.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
