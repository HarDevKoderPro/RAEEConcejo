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

// --- Ficha /p/:id ----------------------------------------------------------------------

test('la ficha de RAEE-0010 muestra categoría, ubicación, impacto e historial', async () => {
  const res = await request(app).get('/p/RAEE-0010').expect(200).expect('Content-Type', /html/);
  assert.match(res.text, /Disco duro 3\.5/);
  assert.match(res.text, /Sala 1 · Estante A1/);
  assert.match(res.text, /Volvió a la vida en el equipo PC-11/);
  assert.match(res.text, /Borrado seguro realizado/);
  assert.match(res.text, /class="linea-tiempo"/);
  assert.match(res.text, /dato de demostración/);
});

test('la ficha pública no muestra notas internas ni usuarios', async () => {
  const res = await request(app).get('/p/RAEE-0010').expect(200);
  assert.doesNotMatch(res.text, /DBAN/); // está en 'notas'
  assert.doesNotMatch(res.text, /instructor/); // usuario del movimiento
});

test('RAEE-0001 (registro real) no lleva la marca de demostración', async () => {
  const res = await request(app).get('/p/RAEE-0001').expect(200);
  assert.match(res.text, /Foxconn/);
  assert.doesNotMatch(res.text, /dato de demostración/);
});

test('un disco sin borrado seguro lo advierte', async () => {
  const res = await request(app).get('/p/RAEE-0014').expect(200);
  assert.match(res.text, /Borrado seguro pendiente/);
});

test('una variante del ID redirige a la forma canónica', async () => {
  await request(app).get('/p/raee-10').expect(301).expect('Location', '/p/RAEE-0010');
});

test('etiqueta impresa sin pieza: "Etiqueta sin registrar"', async () => {
  const res = await request(app).get('/p/RAEE-0040').expect(200);
  assert.match(res.text, /Etiqueta sin registrar/);
});

test('ID inexistente: 404 amable "No está en el inventario"', async () => {
  const res = await request(app).get('/p/RAEE-0999').expect(404);
  assert.match(res.text, /No está en el inventario/);
  assert.match(res.text, /resultado-error/);
});

test('texto que no es ID: 404 amable y escapado', async () => {
  const res = await request(app).get('/p/%3Cscript%3Ealert(1)%3C%2Fscript%3E').expect(404);
  assert.doesNotMatch(res.text, /<script>alert/);
});

test('el formulario /ir lleva a la ficha', async () => {
  await request(app).get('/ir?id=raee%2010').expect(303).expect('Location', '/p/RAEE-0010');
});

test('el texto de la ficha se escapa (sin HTML inyectado)', async () => {
  prueba.db.prepare("UPDATE piezas SET descripcion = '<img src=x onerror=alert(1)>' WHERE id = 'RAEE-0035'").run();
  const res = await request(app).get('/p/RAEE-0035').expect(200);
  assert.doesNotMatch(res.text, /<img src=x/);
  assert.match(res.text, /&lt;img src=x/);
});

// --- Kiosco y portada ------------------------------------------------------------------

test('/consulta carga el campo de escaneo y su script', async () => {
  const res = await request(app).get('/consulta').expect(200);
  assert.match(res.text, /id="escaneo"/);
  assert.match(res.text, /src="\/js\/consulta\.js"/);
});

test('la portada responde y muestra el aviso de datos de demostración', async () => {
  const res = await request(app).get('/').expect(200);
  assert.match(res.text, /Incluye datos de demostración/);
});

test('sin el aviso activado no aparece', async () => {
  const otra = crearApp({ db: prueba.db, opciones: { mostrarAvisoDemo: false } });
  const res = await request(otra).get('/').expect(200);
  assert.doesNotMatch(res.text, /Incluye datos de demostración/);
});

test('una página inexistente responde 404 con la plantilla amable', async () => {
  const res = await request(app).get('/no-existe').expect(404);
  assert.match(res.text, /No encontramos esta página/);
  assert.match(res.text, /<html/);
});

test('CSP sin unsafe-inline en scripts', async () => {
  const res = await request(app).get('/').expect(200);
  const csp = res.headers['content-security-policy'];
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-inline/);
});

test('el CSS y el script del kiosco se sirven', async () => {
  await request(app).get('/css/estilos.css').expect(200).expect('Content-Type', /css/);
  await request(app).get('/js/consulta.js').expect(200).expect('Content-Type', /javascript/);
});

// --- API --------------------------------------------------------------------------------

test('/api/piezas/:id devuelve la pieza y su historial, sin notas', async () => {
  const res = await request(app).get('/api/piezas/RAEE-0010').expect(200).expect('Content-Type', /json/);
  assert.equal(res.body.resultado, 'registrada');
  assert.equal(res.body.pieza.id, 'RAEE-0010');
  assert.equal(res.body.pieza.ubicacion, 'S1-E1');
  assert.ok(!('notas' in res.body.pieza), 'no debe exponer notas');
  assert.ok(res.body.historial.length > 0);
  for (const m of res.body.historial) {
    assert.ok(!('usuario' in m) && !('nota' in m), 'el historial público no lleva usuario ni nota');
  }
  assert.doesNotMatch(JSON.stringify(res.body), /DBAN|instructor/);
});

test('/api/piezas/:id normaliza la variante del ID', async () => {
  const res = await request(app).get('/api/piezas/raee-10').expect(200);
  assert.equal(res.body.id, 'RAEE-0010');
});

test('/api/piezas/:id distingue etiqueta sin registrar e inexistente', async () => {
  const sin = await request(app).get('/api/piezas/RAEE-0040').expect(404);
  assert.equal(sin.body.resultado, 'sin_registrar');
  const no = await request(app).get('/api/piezas/RAEE-0999').expect(404);
  assert.equal(no.body.resultado, 'no_existe');
});

test('/api/escaneo resuelve un enlace completo', async () => {
  const url = encodeURIComponent('https://raee.dominio.com/p/RAEE-0005');
  const res = await request(app).get(`/api/escaneo?texto=${url}`).expect(200);
  assert.equal(res.body.pieza.id, 'RAEE-0005');
});

test('/api/escaneo avisa del QR antiguo', async () => {
  const texto = encodeURIComponent('RAEE-0001\nTipo: Tarjeta madre');
  const res = await request(app).get(`/api/escaneo?texto=${texto}`).expect(422);
  assert.equal(res.body.error, 'QR_ANTIGUO');
  assert.match(res.body.mensaje, /QR antiguo/);
});

test('/api/escaneo rechaza un código que no es del inventario', async () => {
  const res = await request(app).get('/api/escaneo?texto=7501031311309').expect(400);
  assert.equal(res.body.error, 'NO_RECONOCIDO');
});

test('una ruta de la API inexistente responde JSON 404', async () => {
  const res = await request(app).get('/api/nada').expect(404).expect('Content-Type', /json/);
  assert.equal(res.body.resultado, 'error');
});
