// Configuración inicial: el primer administrador se crea desde la página, una sola vez.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { crearDbPrueba } from './ayuda.js';

let prueba;
let app;
before(() => {
  prueba = crearDbPrueba(); // sin usuarios
  app = crearApp({ db: prueba.db, opciones: { sessionSecret: 'secreto-de-pruebas', dbPath: prueba.db.name } });
});
after(() => prueba.limpiar());

const tokenDe = (html) => html.match(/name="_csrf" value="([^"]+)"/)?.[1];
const datos = { nombre: 'Instructor de Prueba', documento: '12.345.678', usuario: 'Admin', contrasena: 'clave-inicial-1', repetir: 'clave-inicial-1' };

test('sin usuarios, Entrar lleva a la configuración inicial', async () => {
  await request(app).get('/entrar').expect(303).expect('Location', '/primer-uso');
  const res = await request(app).get('/primer-uso').expect(200);
  assert.match(res.text, /Crea el administrador/);
});

test('valida contraseñas y documento', async () => {
  const ag = request.agent(app);
  const pagina = await ag.get('/primer-uso');
  const mal = await ag.post('/primer-uso').type('form').send({ ...datos, repetir: 'otra-cosa-12', _csrf: tokenDe(pagina.text) }).expect(422);
  assert.match(mal.text, /no coinciden/);
  const sinDoc = await ag.post('/primer-uso').type('form').send({ ...datos, documento: '', _csrf: tokenDe(pagina.text) }).expect(422);
  assert.match(sinDoc.text, /documento/);
  assert.equal(prueba.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 0);
});

test('crea el administrador, entra con él y la página se desactiva', async () => {
  const ag = request.agent(app);
  const pagina = await ag.get('/primer-uso');
  await ag.post('/primer-uso').type('form').send({ ...datos, _csrf: tokenDe(pagina.text) }).expect(303).expect('Location', '/admin#usuarios');
  const u = prueba.db.prepare('SELECT usuario, rol, documento, activo FROM usuarios').all();
  assert.deepEqual(u, [{ usuario: 'admin', rol: 'admin', documento: '12345678', activo: 1 }]);
  await ag.get('/admin').expect(200); // ya tiene sesión de administrador

  await request(app).get('/primer-uso').expect(303).expect('Location', '/entrar');
  const otro = request.agent(app);
  const form = await otro.get('/entrar').expect(200);
  await otro.post('/primer-uso').type('form')
    .send({ ...datos, usuario: 'intruso', documento: '99999999', _csrf: tokenDe(form.text) }).expect(303).expect('Location', '/entrar');
  assert.equal(prueba.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 1);
});

test('reiniciar desde /admin vuelve a la configuración inicial y guarda un respaldo', async () => {
  const ag = request.agent(app);
  const form = await ag.get('/entrar');
  await ag.post('/entrar').type('form').send({ _csrf: tokenDe(form.text), usuario: 'ADMIN', contrasena: datos.contrasena, siguiente: '/admin' }).expect(303);
  const pagina = await ag.get('/admin').expect(200);
  assert.match(pagina.text, /Reiniciar el sitio/);
  const mal = await ag.post('/admin/reiniciar').type('form').send({ _csrf: tokenDe(pagina.text), confirmar_reinicio: 'si' }).expect(422);
  assert.match(mal.text, /REINICIAR/);
  const piezasAntes = prueba.db.prepare('SELECT COUNT(*) AS n FROM piezas').get().n;

  await ag.post('/admin/reiniciar').type('form').send({ _csrf: tokenDe(pagina.text), confirmar_reinicio: 'reiniciar' })
    .expect(303).expect('Location', '/primer-uso');
  assert.equal(prueba.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 0);
  assert.equal(prueba.db.prepare('SELECT COUNT(*) AS n FROM piezas').get().n, piezasAntes, 'sin la casilla, el inventario se conserva');
  await ag.get('/admin').expect(303).expect('Location', /^\/entrar/);
  await request(app).get('/entrar').expect(303).expect('Location', '/primer-uso');
  const respaldos = fs.readdirSync(path.join(path.dirname(prueba.db.name), 'respaldos'));
  assert.ok(respaldos.some((f) => f.startsWith('antes-de-reiniciar-')));

  // Otra vez: crear el administrador y reiniciar vaciando el inventario.
  const ag2 = request.agent(app);
  const p2 = await ag2.get('/primer-uso');
  await ag2.post('/primer-uso').type('form').send({ ...datos, _csrf: tokenDe(p2.text) }).expect(303);
  const adm = await ag2.get('/admin').expect(200);
  await ag2.post('/admin/reiniciar').type('form').send({ _csrf: tokenDe(adm.text), confirmar_reinicio: 'REINICIAR', vaciar_inventario: '1' }).expect(303);
  assert.equal(prueba.db.prepare('SELECT COUNT(*) AS n FROM piezas').get().n, 0);
  assert.equal(prueba.db.prepare('SELECT COUNT(*) AS n FROM movimientos').get().n, 0);
  assert.ok(prueba.db.prepare('SELECT COUNT(*) AS n FROM etiquetas').get().n > 0, 'las etiquetas se conservan');
});
