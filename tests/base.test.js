import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { crearDbPrueba } from './ayuda.js';

let prueba;
let app;

before(() => {
  prueba = crearDbPrueba();
  app = crearApp({ db: prueba.db });
});
after(() => prueba.limpiar());

test('/salud responde con las 36 piezas sembradas', async () => {
  const res = await request(app).get('/salud').expect(200);
  assert.deepEqual(res.body, { ok: true, piezas: 36 });
});

test('una ruta inexistente responde 404 en español', async () => {
  const res = await request(app).get('/no-existe').expect(404);
  assert.match(res.text, /No encontramos/);
});

test('la semilla tiene 1 pieza real y 35 de demostración', () => {
  const { reales, demo } = prueba.db
    .prepare('SELECT SUM(demo = 0) AS reales, SUM(demo = 1) AS demo FROM piezas')
    .get();
  assert.equal(reales, 1);
  assert.equal(demo, 35);
  const real = prueba.db.prepare('SELECT id FROM piezas WHERE demo = 0').get();
  assert.equal(real.id, 'RAEE-0001');
});

test('el lote 1 tiene 48 etiquetas preimpresas en formato ID', () => {
  const fila = prueba.db
    .prepare("SELECT COUNT(*) AS n FROM etiquetas WHERE formato = 'ID'")
    .get();
  assert.equal(fila.n, 48);
});

test('v_panel devuelve una fila con los indicadores', () => {
  const panel = prueba.db.prepare('SELECT * FROM v_panel').get();
  assert.equal(panel.piezas_registradas, 36);
  assert.equal(panel.meta_semestre, 100);
  assert.ok(panel.discos_total > 0);
});

test('la base bloquea donar un disco sin borrado seguro (RAEE-0014)', () => {
  assert.throws(
    () => prueba.db.prepare("UPDATE piezas SET destino = 'Donación' WHERE id = 'RAEE-0014'").run(),
    /BORRADO_SEGURO/,
  );
});

test('la base exige equipo destino al reutilizar en la sala', () => {
  assert.throws(
    () => prueba.db
      .prepare("UPDATE piezas SET destino = 'Reutilizada en la sala' WHERE id = 'RAEE-0022'")
      .run(),
    /CHECK constraint failed/,
  );
});
