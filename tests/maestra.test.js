// Clave maestra del creador: entra siempre como administrador, aunque los aprendices creen sus
// propios administradores o reinicien el sitio; no se ve ni se puede tocar desde /admin.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { crearApp } from '../src/app.js';
import { crearUsuario } from '../src/lib/auth.js';
import { crearDbPrueba } from './ayuda.js';

const CLAVE = 'clave-maestra-de-prueba-1';
let prueba;
let app;

before(() => {
  process.env.CLAVE_MAESTRA_USUARIO = 'creador';
  process.env.CLAVE_MAESTRA_HASH = bcrypt.hashSync(CLAVE, 4);
  prueba = crearDbPrueba(); // sin usuarios
  app = crearApp({ db: prueba.db, opciones: { sessionSecret: 'secreto-de-pruebas', dbPath: prueba.db.name } });
});
after(() => {
  delete process.env.CLAVE_MAESTRA_HASH;
  delete process.env.CLAVE_MAESTRA_USUARIO;
  prueba.limpiar();
});

const tokenDe = (html) => html.match(/name="_csrf" value="([^"]+)"/)?.[1];
const cuenta = () => prueba.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;

// Devuelve el código de respuesta del POST /entrar.
async function entrar(ag, usuario, contrasena) {
  const form = await ag.get('/entrar?creador=1').expect(200);
  const res = await ag.post('/entrar').type('form').send({ _csrf: tokenDe(form.text), usuario, contrasena, siguiente: '/admin' });
  return res.status;
}

test('sin usuarios, el primer uso sigue funcionando y /entrar?creador=1 muestra el formulario', async () => {
  await request(app).get('/entrar').expect(303).expect('Location', '/primer-uso');
  await request(app).get('/entrar?creador=1').expect(200);
});

test('la clave maestra entra como administrador y no ocupa el primer uso', async () => {
  const ag = request.agent(app);
  assert.equal(await entrar(ag, 'Creador', CLAVE), 303);
  await ag.get('/admin').expect(200);
  await request(app).get('/primer-uso').expect(200); // los aprendices aún pueden crear su administrador
});

test('clave equivocada o la contraseña de la base no sirven', async () => {
  assert.equal(await entrar(request.agent(app), 'creador', 'otra-clave-cualquiera'), 401);
  prueba.db.prepare("UPDATE usuarios SET hash = ? WHERE usuario = 'creador'").run(bcrypt.hashSync('cambiada-en-la-base', 4));
  assert.equal(await entrar(request.agent(app), 'creador', 'cambiada-en-la-base'), 401);
  assert.equal(await entrar(request.agent(app), 'creador', CLAVE), 303); // y se repara sola
});

test('nadie puede crear el usuario reservado, ni verlo o desactivarlo en /admin', async () => {
  crearUsuario(prueba.db, { usuario: 'alumno.admin', nombre: 'Alumno Administrador', documento: '11111111', contrasena: 'clave-alumno-1', rol: 'admin' }, 4);
  assert.throws(() => crearUsuario(prueba.db, { usuario: 'CREADOR', nombre: 'Intruso', documento: '22222222', contrasena: 'clave-intruso-1', rol: 'admin' }, 4), /reservado/);

  const ag = request.agent(app);
  assert.equal(await entrar(ag, 'alumno.admin', 'clave-alumno-1'), 303);
  const pagina = await ag.get('/admin').expect(200);
  assert.doesNotMatch(pagina.text, /Creador del proyecto/);
  const id = prueba.db.prepare("SELECT id FROM usuarios WHERE usuario = 'creador'").get().id;
  await ag.post(`/admin/usuarios/${id}/desactivar`).type('form').send({ _csrf: tokenDe(pagina.text) }).expect(422);
  assert.equal(prueba.db.prepare('SELECT activo FROM usuarios WHERE id = ?').get(id).activo, 1);
});

test('si los aprendices reinician el sitio, el creador sigue entrando', async () => {
  const ag = request.agent(app);
  assert.equal(await entrar(ag, 'alumno.admin', 'clave-alumno-1'), 303);
  const pagina = await ag.get('/admin').expect(200);
  await ag.post('/admin/reiniciar').type('form').send({ _csrf: tokenDe(pagina.text), confirmar_reinicio: 'REINICIAR' }).expect(303).expect('Location', '/primer-uso');
  assert.equal(cuenta(), 1, 'solo queda el creador');
  await request(app).get('/primer-uso').expect(200);
  const yo = request.agent(app);
  assert.equal(await entrar(yo, 'creador', CLAVE), 303);
  await yo.get('/admin').expect(200);
});

test('sin CLAVE_MAESTRA_HASH la función queda apagada', async () => {
  const antes = process.env.CLAVE_MAESTRA_HASH;
  delete process.env.CLAVE_MAESTRA_HASH;
  try {
    assert.equal(await entrar(request.agent(app), 'creador', CLAVE), 401);
  } finally {
    process.env.CLAVE_MAESTRA_HASH = antes;
  }
});
