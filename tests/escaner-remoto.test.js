// Celular como lector: quien tiene sesión abre una etiqueta con la cámara del celular y su PC
// (en /consulta, /movimiento o /demo) la recibe por su canal privado, como si fuera un lector.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { crearUsuario } from '../src/lib/auth.js';
import { crearDbPrueba } from './ayuda.js';

const UNO = { usuario: 'lector.uno', nombre: 'Lector Uno', documento: '11111111', contrasena: 'clave-lector-1' };
const DOS = { usuario: 'lector.dos', nombre: 'Lector Dos', documento: '22222222', contrasena: 'clave-lector-2' };

let prueba;
let servidor;
let puerto;

before(async () => {
  prueba = crearDbPrueba();
  crearUsuario(prueba.db, UNO, 4);
  crearUsuario(prueba.db, DOS, 4);
  const app = crearApp({ db: prueba.db, opciones: { sessionSecret: 'secreto-de-pruebas' } });
  servidor = http.createServer(app);
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  puerto = servidor.address().port;
});
after(async () => {
  servidor.closeAllConnections?.();
  await new Promise((ok) => servidor.close(ok));
  prueba.limpiar();
});

const tokenDe = (html) => html.match(/name="_csrf" value="([^"]+)"/)?.[1];
const galleta = (res) => (res.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]).join('; ');

// Devuelve la cookie de sesión de un usuario ya autenticado.
async function sesionDe(quien) {
  const form = await request(servidor).get('/entrar').expect(200);
  const c1 = galleta(form);
  const res = await request(servidor).post('/entrar').set('Cookie', c1).type('form')
    .send({ _csrf: tokenDe(form.text), usuario: quien.usuario, contrasena: quien.contrasena, siguiente: '/' }).expect(303);
  return galleta(res) || c1;
}

function abrirCanalPrivado(cookie) {
  return new Promise((ok, falla) => {
    const eventos = [];
    const req = http.get({ host: '127.0.0.1', port: puerto, path: '/eventos?mios=1', headers: { Cookie: cookie } }, (res) => {
      let bufer = '';
      res.setEncoding('utf8');
      res.on('data', (t) => {
        bufer += t;
        let corte;
        while ((corte = bufer.indexOf('\n\n')) !== -1) {
          const bloque = bufer.slice(0, corte);
          bufer = bufer.slice(corte + 2);
          const tipo = bloque.match(/^event: (.+)$/m)?.[1];
          const datos = bloque.match(/^data: (.+)$/m)?.[1];
          if (tipo) eventos.push({ tipo, datos: JSON.parse(datos) });
        }
      });
      ok({ res, eventos, cerrar: () => req.destroy() });
    });
    req.on('error', falla);
  });
}

const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));
const escaneos = (canal) => canal.eventos.filter((e) => e.tipo === 'escaneo').map((e) => e.datos.id);

test('el canal privado exige sesión', async () => {
  await request(servidor).get('/eventos?mios=1').expect(303).expect('Location', /^\/entrar/);
});

test('abrir una etiqueta desde el celular llega solo al PC del mismo usuario', async () => {
  const cUno = await sesionDe(UNO);
  const cDos = await sesionDe(DOS);
  const pcUno = await abrirCanalPrivado(cUno);
  const pcDos = await abrirCanalPrivado(cDos);
  assert.equal(pcUno.res.headers['content-type'], 'text/event-stream; charset=utf-8');
  await pausa(50);

  // El celular de UNO abre el enlace del QR (navegación normal).
  await request(servidor).get('/p/RAEE-0010').set('Cookie', cUno).set('Sec-Fetch-Mode', 'navigate').expect(200);
  // Etiqueta preimpresa sin pieza: el celular va a Registrar y el PC también la recibe.
  await request(servidor).get('/p/RAEE-0040').set('Cookie', cUno).expect(303);
  await pausa(100);
  assert.deepEqual(escaneos(pcUno), ['RAEE-0010', 'RAEE-0040']);
  assert.deepEqual(escaneos(pcDos), [], 'otro usuario no recibe nada');

  // Las recargas en vivo de la ficha (fetch) y las visitas sin sesión no cuentan.
  await request(servidor).get('/p/RAEE-0011').set('Cookie', cUno).set('X-Refresco', '1').expect(200);
  await request(servidor).get('/p/RAEE-0012').set('Cookie', cUno).set('Sec-Fetch-Mode', 'cors').expect(200);
  await request(servidor).get('/p/RAEE-0013').expect(200);
  await pausa(100);
  assert.deepEqual(escaneos(pcUno), ['RAEE-0010', 'RAEE-0040']);

  pcUno.cerrar();
  pcDos.cerrar();
});

test('las páginas de escaneo muestran el aviso del celular solo con sesión', async () => {
  const c = await sesionDe(UNO);
  const conSesion = await request(servidor).get('/consulta').set('Cookie', c).expect(200);
  assert.match(conSesion.text, /Celular como lector/);
  assert.match(conSesion.text, /escaner-remoto\.js/);
  const mov = await request(servidor).get('/movimiento').set('Cookie', c).expect(200);
  assert.match(mov.text, /escaner-remoto\.js/);
  const publica = await request(servidor).get('/consulta').expect(200);
  assert.doesNotMatch(publica.text, /escaner-remoto/);
});
