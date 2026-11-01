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

const ids = (res) => res.body.piezas.map((p) => p.id);
const ramDdr3 = () =>
  prueba.db
    .prepare("SELECT id FROM v_piezas WHERE categoria = 'Memoria RAM' AND descripcion LIKE '%DDR3%' ORDER BY id")
    .all()
    .map((r) => r.id);

// --- Criterios de aceptación de la fase 3 -------------------------------------------------

test('buscar "DDR3" incluye todas las RAM DDR3', async () => {
  const res = await request(app).get('/api/buscar?q=DDR3').expect(200);
  const esperadas = ramDdr3();
  assert.ok(esperadas.length >= 5);
  for (const id of esperadas) assert.ok(ids(res).includes(id), `falta ${id}`);
});

test('buscar "RAM DDR3" da solo las RAM DDR3', async () => {
  const res = await request(app).get('/api/buscar?q=RAM%20DDR3').expect(200);
  assert.deepEqual(ids(res), ramDdr3());
});

test('filtrar por "Sala 1 · Caja 2" da solo lo de esa caja', async () => {
  const res = await request(app).get('/api/buscar?ubicacion=S1-C2').expect(200);
  const esperadas = prueba.db.prepare("SELECT id FROM piezas WHERE ubicacion = 'S1-C2' ORDER BY id").all().map((r) => r.id);
  assert.ok(esperadas.length > 0);
  assert.deepEqual(ids(res), esperadas);
  assert.ok(res.body.piezas.every((p) => p.ubicacion_nombre === 'Sala 1 · Caja 2'));
});

test('la ficha enlaza al mapa y el mapa resalta la caja de la pieza', async () => {
  const ficha = await request(app).get('/p/RAEE-0010').expect(200);
  assert.match(ficha.text, /href="\/ubicaciones\?resaltar=RAEE-0010"/);

  const mapa = await request(app).get('/ubicaciones?resaltar=RAEE-0010').expect(200);
  assert.match(mapa.text, /id="lugar-resaltado"/);
  assert.match(mapa.text, /Aquí está RAEE-0010/);
  // El lugar resaltado es S1-E1 (Estante A1), donde está RAEE-0010.
  assert.match(mapa.text, /href="\/ubicaciones\/S1-E1"\s+id="lugar-resaltado"/);
  assert.equal((mapa.text.match(/id="lugar-resaltado"/g) || []).length, 1);
});

// --- Búsqueda ------------------------------------------------------------------------------

test('la búsqueda no distingue mayúsculas y combina palabras', async () => {
  const res = await request(app).get('/api/buscar?q=seagate%20500').expect(200);
  assert.ok(ids(res).includes('RAEE-0010'));
  assert.ok(res.body.piezas.every((p) => /seagate/i.test(p.marca)));
});

test('un ID escrito a mano se encuentra (raee 10)', async () => {
  const res = await request(app).get('/api/buscar?q=raee%2010').expect(200);
  assert.ok(ids(res).includes('RAEE-0010'));
});

test('busca por serial', async () => {
  const res = await request(app).get('/api/buscar?q=UYRL81507803').expect(200);
  assert.deepEqual(ids(res), ['RAEE-0001']);
});

test('los filtros se combinan (categoría + estado)', async () => {
  const res = await request(app).get('/api/buscar?categoria=2&estado=Funcional').expect(200);
  assert.ok(res.body.total > 0);
  assert.ok(res.body.piezas.every((p) => p.categoria === 'Memoria RAM' && p.estado === 'Funcional'));
});

test('los comodines de LIKE se tratan como texto', async () => {
  const res = await request(app).get('/api/buscar?q=%25').expect(200);
  assert.equal(res.body.total, 0);
  const res2 = await request(app).get('/api/buscar?q=_').expect(200);
  assert.equal(res2.body.total, 0);
});

test('filtros inválidos se ignoran sin error', async () => {
  const res = await request(app).get("/api/buscar?estado=Inventado&ubicacion=X'%20OR%201=1&categoria=abc").expect(200);
  assert.equal(res.body.total, 36);
});

test('sin filtros devuelve todo el inventario', async () => {
  const res = await request(app).get('/api/buscar').expect(200);
  assert.equal(res.body.total, 36);
});

test('la API de búsqueda no expone notas', async () => {
  const res = await request(app).get('/api/buscar').expect(200);
  assert.doesNotMatch(JSON.stringify(res.body), /"notas"|DBAN|MemTest/);
});

test('/buscar muestra resultados, filtros activos y se puede compartir por URL', async () => {
  const res = await request(app).get('/buscar?q=DDR3&ubicacion=S1-E1').expect(200);
  assert.match(res.text, /«DDR3» ✕/);
  assert.match(res.text, /📍 Sala 1 · Estante A1 ✕/);
  assert.match(res.text, /<option value="S1-E1" selected>/);
  assert.match(res.text, /href="\/p\/RAEE-0002"/);
});

test('/buscar sin resultados muestra un estado vacío amable', async () => {
  const res = await request(app).get('/buscar?q=zzzzzz').expect(200);
  assert.match(res.text, /No encontramos piezas/);
});

test('/buscar escapa el texto buscado', async () => {
  const res = await request(app).get('/buscar?q=%3Cscript%3Ex%3C%2Fscript%3E').expect(200);
  assert.doesNotMatch(res.text, /<script>x/);
});

// --- Mapa ----------------------------------------------------------------------------------

test('/ubicaciones muestra cada lugar con su conteo', async () => {
  const res = await request(app).get('/ubicaciones').expect(200);
  const lugares = prueba.db.prepare('SELECT codigo FROM ubicaciones').all();
  for (const { codigo } of lugares) assert.match(res.text, new RegExp(`href="/ubicaciones/${codigo}"`));
  const n = prueba.db.prepare("SELECT COUNT(*) AS n FROM piezas WHERE ubicacion = 'S1-C2'").get().n;
  assert.match(res.text, new RegExp(`<strong>${n}</strong> piezas`));
  assert.doesNotMatch(res.text, /id="lugar-resaltado"/);
});

test('/ubicaciones?resaltar con ID inexistente avisa sin error', async () => {
  const res = await request(app).get('/ubicaciones?resaltar=RAEE-0999').expect(200);
  assert.match(res.text, /no está en el inventario/);
});

test('/ubicaciones/:codigo lista solo las piezas de ese lugar', async () => {
  const res = await request(app).get('/ubicaciones/S1-C2').expect(200);
  assert.match(res.text, /Sala 1 · Caja 2/);
  const dentro = prueba.db.prepare("SELECT id FROM piezas WHERE ubicacion = 'S1-C2'").all();
  for (const { id } of dentro) assert.match(res.text, new RegExp(`href="/p/${id}"`));
  assert.doesNotMatch(res.text, /href="\/p\/RAEE-0010"/);
});

test('/ubicaciones/:codigo acepta minúsculas y da 404 amable si no existe', async () => {
  await request(app).get('/ubicaciones/s1-c2').expect(301).expect('Location', '/ubicaciones/S1-C2');
  const res = await request(app).get('/ubicaciones/NO-EXISTE').expect(404);
  assert.match(res.text, /Esa ubicación no existe/);
});

test('el mapa muestra el nombre de cada lugar, no solo su tipo', async () => {
  const res = await request(app).get('/ubicaciones').expect(200);
  assert.match(res.text, /class="lugar-nombre">Caja 1</);
  assert.match(res.text, /class="lugar-nombre">Estante A1</);
  assert.match(res.text, /class="lugar-nombre">Punto de acopio RAEE</);
});
