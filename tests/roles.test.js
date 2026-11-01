// Roles: administrador (todo) y registrador (ver, registrar, mover, etiquetas). Eliminar piezas
// deja rastro; el historial muestra el nombre de quien hizo cada operación, nunca el documento.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import Database from 'better-sqlite3';
import { crearApp } from '../src/app.js';
import { crearUsuario } from '../src/lib/auth.js';
import { aplicarEsquema } from '../src/db.js';
import { crearDbPrueba } from './ayuda.js';

const REG = { usuario: 'registrador.prueba', nombre: 'Laura Martínez Rojas', documento: '1098765432', contrasena: 'clave-registro-1', rol: 'editor' };
const ADMIN = { usuario: 'admin.roles', nombre: 'Carlos Pérez Díaz', documento: '79123456', contrasena: 'clave-admin-123', rol: 'admin' };

let prueba;
let app;

before(() => {
  prueba = crearDbPrueba();
  crearUsuario(prueba.db, REG, 4);
  crearUsuario(prueba.db, ADMIN, 4);
  app = crearApp({ db: prueba.db, opciones: { sessionSecret: 'secreto-de-pruebas' } });
});
after(() => prueba.limpiar());

const tokenDe = (html) => html.match(/name="_csrf" value="([^"]+)"/)?.[1];
const metaToken = (html) => html.match(/name="csrf-token" content="([^"]+)"/)?.[1];

async function entrar(quien) {
  const agente = request.agent(app);
  const form = await agente.get('/entrar').expect(200);
  await agente.post('/entrar').type('form')
    .send({ _csrf: tokenDe(form.text), usuario: quien.usuario, contrasena: quien.contrasena, siguiente: '/' }).expect(303);
  return agente;
}

describe('registrador', () => {
  test('puede registrar, mover e imprimir etiquetas', async () => {
    const ag = await entrar(REG);
    await ag.get('/registrar').expect(200);
    await ag.get('/etiquetas').expect(200);
    const pagina = await ag.get('/movimiento').expect(200);
    await ag.post('/api/piezas/RAEE-0007/movimiento').set('x-csrf-token', metaToken(pagina.text))
      .send({ campo: 'estado', valor: 'Funcional' }).expect(200);
  });

  test('no puede editar todo, eliminar ni entrar a /admin', async () => {
    const ag = await entrar(REG);
    await ag.get('/p/RAEE-0010/editar').expect(403);
    await ag.get('/p/RAEE-0010/eliminar').expect(403);
    const ficha = await ag.get('/p/RAEE-0010').expect(200);
    await ag.post('/p/RAEE-0010/eliminar').type('form').send({ _csrf: tokenDe(ficha.text), motivo: 'intento' }).expect(403);
    await ag.get('/admin').expect(403);
    assert.doesNotMatch(ficha.text, /Editar todo|Eliminar esta pieza/);
    assert.ok(prueba.db.prepare("SELECT 1 FROM piezas WHERE id = 'RAEE-0010'").get());
  });

  test('el historial muestra el nombre completo de quien hizo el cambio, nunca el documento', async () => {
    const ag = await entrar(REG);
    const ficha = await ag.get('/p/RAEE-0007').expect(200);
    assert.match(ficha.text, /Laura Martínez Rojas/);
    assert.doesNotMatch(ficha.text, /1098765432/);
    const publica = await request(app).get('/p/RAEE-0007').expect(200);
    assert.doesNotMatch(publica.text, /Laura Martínez Rojas|1098765432/);
  });
});

describe('administrador: eliminar piezas', () => {
  test('exige motivo', async () => {
    const ag = await entrar(ADMIN);
    const pagina = await ag.get('/p/RAEE-0030/eliminar').expect(200);
    const res = await ag.post('/p/RAEE-0030/eliminar').type('form').send({ _csrf: tokenDe(pagina.text), motivo: '' }).expect(422);
    assert.match(res.text, /Escribe el motivo/);
    assert.ok(prueba.db.prepare("SELECT 1 FROM piezas WHERE id = 'RAEE-0030'").get());
  });

  test('elimina la pieza y deja el rastro con motivo, quién y su historial', async () => {
    const ag = await entrar(ADMIN);
    const movimientos = prueba.db.prepare("SELECT COUNT(*) AS n FROM movimientos WHERE pieza_id = 'RAEE-0030'").get().n;
    const pagina = await ag.get('/p/RAEE-0030/eliminar').expect(200);
    await ag.post('/p/RAEE-0030/eliminar').type('form')
      .send({ _csrf: tokenDe(pagina.text), motivo: 'Registrada por error' }).expect(303).expect('Location', '/buscar');
    assert.equal(prueba.db.prepare("SELECT 1 FROM piezas WHERE id = 'RAEE-0030'").get(), undefined);
    const rastro = prueba.db.prepare("SELECT * FROM piezas_eliminadas WHERE pieza_id = 'RAEE-0030'").get();
    assert.equal(rastro.motivo, 'Registrada por error');
    assert.equal(rastro.usuario, ADMIN.usuario);
    const datos = JSON.parse(rastro.datos);
    assert.equal(datos.pieza.id, 'RAEE-0030');
    assert.equal(datos.historial.length, movimientos);
    assert.ok(prueba.db.prepare("SELECT 1 FROM etiquetas WHERE id = 'RAEE-0030'").get(), 'la etiqueta se conserva');
    const admin = await ag.get('/admin').expect(200);
    assert.match(admin.text, /Registrada por error/);
    assert.match(admin.text, /Carlos Pérez Díaz/);
    await request(app).get('/p/RAEE-0030').expect(200); // etiqueta sin registrar
  });

  test('el admin sí puede editar todo', async () => {
    const ag = await entrar(ADMIN);
    await ag.get('/p/RAEE-0010/editar').expect(200);
    const ficha = await ag.get('/p/RAEE-0010').expect(200);
    assert.match(ficha.text, /Editar todo/);
    assert.match(ficha.text, /Eliminar esta pieza/);
  });
});

describe('usuarios', () => {
  test('el documento es obligatorio en el formulario y no se repite', async () => {
    const ag = await entrar(ADMIN);
    const pagina = await ag.get('/admin').expect(200);
    const base = { _csrf: tokenDe(pagina.text), usuario: 'nuevo.uno', nombre: 'Nuevo Uno', rol: 'editor', contrasena: 'clave-nueva-1', repetir: 'clave-nueva-1' };
    const sin = await ag.post('/admin/usuarios').type('form').send({ ...base, documento: '' }).expect(422);
    assert.match(sin.text, /documento de identidad/);
    const rep = await ag.post('/admin/usuarios').type('form').send({ ...base, documento: '1.098.765.432' }).expect(422);
    assert.match(rep.text, /Ya hay un usuario con ese documento/);
  });

  test('una base anterior recibe las columnas nuevas sin perder usuarios', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raee-migra-'));
    const db = new Database(path.join(dir, 'vieja.db'));
    db.exec(`CREATE TABLE usuarios (id INTEGER PRIMARY KEY, usuario TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL, hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'editor' CHECK (rol IN ('admin','editor')), creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime')));
      INSERT INTO usuarios (usuario, nombre, hash, rol) VALUES ('viejo', 'Usuario Viejo', 'x', 'admin');`);
    aplicarEsquema(db);
    const u = db.prepare("SELECT documento, activo FROM usuarios WHERE usuario = 'viejo'").get();
    assert.equal(u.activo, 1);
    assert.equal(u.documento, null);
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'piezas_eliminadas'").get());
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
