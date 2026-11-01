// Fases 6, 7 y 8: etiquetas QR, exportar a Excel, /admin, /proyecto y limpieza de datos demo.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { crearApp } from '../src/app.js';
import { crearUsuario } from '../src/lib/auth.js';
import { reservarIds, idsSolicitados, marcarImpresas } from '../src/lib/etiquetas.js';
import { siguienteId } from '../src/lib/ids.js';
import { crearDbPrueba } from './ayuda.js';

const EDITOR = { usuario: 'editor.cierre', nombre: 'Editor Cierre', contrasena: 'clave-de-prueba-789' };
const ADMIN = { usuario: 'admin.cierre', nombre: 'Admin Cierre', contrasena: 'clave-de-prueba-000', rol: 'admin' };
const BASE = 'https://raee.ejemplo.test';

let prueba;
let app;
let dirFotos;

before(() => {
  prueba = crearDbPrueba();
  dirFotos = fs.mkdtempSync(path.join(os.tmpdir(), 'raee-fotos-'));
  crearUsuario(prueba.db, EDITOR, 4);
  crearUsuario(prueba.db, ADMIN, 4);
  app = crearApp({ db: prueba.db, opciones: { sessionSecret: 'secreto-de-pruebas', baseUrl: BASE, fotosDir: dirFotos } });
});
after(() => {
  prueba.limpiar();
  fs.rmSync(dirFotos, { recursive: true, force: true });
});

const tokenDe = (html) => html.match(/name="_csrf" value="([^"]+)"/)?.[1];

async function entrar(quien) {
  const agente = request.agent(app);
  const form = await agente.get('/entrar').expect(200);
  await agente
    .post('/entrar')
    .type('form')
    .send({ _csrf: tokenDe(form.text), usuario: quien.usuario, contrasena: quien.contrasena, siguiente: '/' })
    .expect(303);
  return agente;
}

// Descarga binaria para supertest.
const binario = (res, cb) => {
  const trozos = [];
  res.on('data', (t) => trozos.push(t));
  res.on('end', () => cb(null, Buffer.concat(trozos)));
};

describe('etiquetas QR', () => {
  test('sin sesión redirige a /entrar', async () => {
    await request(app).get('/etiquetas').expect(303).expect('Location', /^\/entrar/);
    await request(app).get('/etiquetas/hoja?desde=1&hasta=3').expect(303);
  });

  test('la hoja por rango trae 24 etiquetas con QR que llevan el enlace a la ficha', async () => {
    const agente = await entrar(EDITOR);
    const res = await agente.get('/etiquetas/hoja?desde=1&hasta=24').expect(200);
    assert.equal((res.text.match(/class="etiqueta"/g) ?? []).length, 24);
    assert.equal((res.text.match(/<svg class="qr"/g) ?? []).length, 24);
    assert.equal((res.text.match(/class="hoja"/g) ?? []).length, 1);
    assert.match(res.text, /Imprimir al 100 %, sin ajustar a página/);
    assert.match(res.text, /SALA DE SISTEMAS/);
    assert.match(res.text, /No retirar esta etiqueta/);
    assert.match(res.text, /RAEE-0024/);
    assert.match(res.text, /title="Disco duro 3\.5&#34;"|title="Disco duro 3.5&quot;"|title="Disco duro 3\.5"/); // ícono de la categoría si la pieza existe
  });

  test('25 etiquetas ocupan 2 hojas; la pequeña cabe en una', async () => {
    const agente = await entrar(EDITOR);
    const normal = await agente.get('/etiquetas/hoja?desde=1&hasta=25').expect(200);
    assert.equal((normal.text.match(/class="hoja"/g) ?? []).length, 2);
    const pequena = await agente.get('/etiquetas/hoja?desde=1&hasta=25&tam=pequena').expect(200);
    assert.equal((pequena.text.match(/class="etiqueta-pequena"/g) ?? []).length, 25);
    assert.equal((pequena.text.match(/class="hoja"/g) ?? []).length, 1);
  });

  test('el QR codifica {BASE_URL}/p/RAEE-NNNN', async () => {
    const { svgQr } = await import('../src/lib/qr.js');
    const QRCode = (await import('qrcode')).default;
    const modelo = QRCode.create(`${BASE}/p/RAEE-0010`, { errorCorrectionLevel: 'M' });
    assert.equal(modelo.errorCorrectionLevel.bit, 0); // M
    const svg = await svgQr(`${BASE}/p/RAEE-0010`);
    assert.match(svg, /^<svg class="qr"/);
  });

  test('rango inválido o demasiado grande muestra un mensaje claro', async () => {
    const agente = await entrar(EDITOR);
    const res = await agente.get('/etiquetas/hoja?desde=30&hasta=10').expect(422);
    assert.match(res.text, /Revisa el rango/);
    const grande = await agente.get('/etiquetas/hoja?desde=1&hasta=999').expect(422);
    assert.match(grande.text, /Máximo 240/);
  });

  test('reservar N IDs nuevos los inserta con formato URL, mayores que cualquier ID existente', () => {
    const antes = siguienteId(prueba.db);
    const { ids, lote } = reservarIds(prueba.db, 3, 'Lote de prueba');
    assert.equal(ids[0], antes);
    assert.equal(ids.length, 3);
    const filas = prueba.db.prepare('SELECT formato, lote FROM etiquetas WHERE id IN (?, ?, ?)').all(...ids);
    assert.ok(filas.every((f) => f.formato === 'URL' && f.lote === lote));
    assert.throws(() => reservarIds(prueba.db, 2, 'Lote de prueba'), /Ya existe un lote/);
    assert.throws(() => reservarIds(prueba.db, 0), /entre 1 y 240/);
  });

  test('reservar desde el formulario lleva a la hoja del lote', async () => {
    const agente = await entrar(EDITOR);
    const form = await agente.get('/etiquetas').expect(200);
    const res = await agente
      .post('/etiquetas/reservar')
      .type('form')
      .send({ _csrf: tokenDe(form.text), cantidad: '2', lote: 'Lote formulario', tam: 'normal' })
      .expect(303);
    assert.match(res.headers.location, /^\/etiquetas\/hoja\?lote=Lote%20formulario/);
    const hoja = await agente.get(res.headers.location).expect(200);
    assert.equal((hoja.text.match(/class="etiqueta"/g) ?? []).length, 2);
  });

  test('reimprimir el lote antiguo y marcarlo como impreso lo pasa a formato URL', async () => {
    const pedido = idsSolicitados(prueba.db, { lote: 'Lote 1 (PDF 0001–0048)' });
    assert.equal(pedido.ids.length, 48);
    marcarImpresas(prueba.db, ['RAEE-0002', 'RAEE-0003']);
    const fila = prueba.db.prepare("SELECT formato, lote FROM etiquetas WHERE id = 'RAEE-0002'").get();
    assert.equal(fila.formato, 'URL');
    assert.match(fila.lote, /^Impresas el /);
  });

  test('marcar impresas sin token CSRF responde 403', async () => {
    const agente = await entrar(EDITOR);
    await agente.post('/etiquetas/impresas').type('form').send({ ids: 'RAEE-0004' }).expect(403);
  });
});

describe('exportar a Excel', () => {
  async function leerLibro(buffer) {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer);
    return libro;
  }

  test('sin sesión: 36 piezas con las columnas de la hoja Inventario y sin notas', async () => {
    prueba.db.prepare("UPDATE piezas SET notas = 'nota-secreta-excel' WHERE id = 'RAEE-0005'").run();
    const res = await request(app).get('/exportar.xlsx').buffer(true).parse(binario).expect(200);
    assert.match(res.headers['content-type'], /spreadsheetml/);
    assert.match(res.headers['content-disposition'], /Inventario_RAEE_\d{4}-\d{2}-\d{2}\.xlsx/);
    const libro = await leerLibro(res.body);
    const hoja = libro.getWorksheet('Inventario');
    assert.equal(hoja.rowCount, 37);
    const encabezados = hoja.getRow(1).values.slice(1);
    for (const c of ['ID', 'Categoría', 'Marca', 'Modelo / P/N', 'Serial', 'Descripción', 'Estado', 'Destino', 'Ubicación', 'Peso (kg)', 'Borrado seguro']) {
      assert.ok(encabezados.includes(c), c);
    }
    assert.ok(!encabezados.includes('Notas internas'));
    assert.ok(libro.getWorksheet('Panel'));
    assert.ok(!libro.getWorksheet('Movimientos'));
    assert.ok(!res.body.toString('latin1').includes('nota-secreta-excel'));
    assert.equal(hoja.getCell('A2').value, 'RAEE-0001');
  });

  test('respeta los filtros de /buscar', async () => {
    const res = await request(app).get('/exportar.xlsx?q=DDR3&estado=Funcional').buffer(true).parse(binario).expect(200);
    const hoja = (await leerLibro(res.body)).getWorksheet('Inventario');
    const filas = hoja.rowCount - 1;
    const esperadas = prueba.db.prepare("SELECT COUNT(*) AS n FROM v_piezas WHERE descripcion LIKE '%DDR3%' AND estado = 'Funcional'").get().n;
    assert.ok(filas >= 1);
    assert.equal(filas, esperadas);
    assert.match(res.headers['content-disposition'], /_filtrado\.xlsx/);
  });

  test('un editor recibe además las notas y el historial', async () => {
    const agente = await entrar(EDITOR);
    const res = await agente.get('/exportar.xlsx').buffer(true).parse(binario).expect(200);
    const libro = await leerLibro(res.body);
    assert.ok(libro.getWorksheet('Inventario').getRow(1).values.includes('Notas internas'));
    assert.ok(libro.getWorksheet('Movimientos').rowCount > 1);
  });

  test('/buscar ofrece el botón Exportar a Excel con los filtros', async () => {
    const res = await request(app).get('/buscar?q=DDR3').expect(200);
    assert.match(res.text, /href="\/exportar\.xlsx\?q=DDR3"/);
  });
});

describe('administración', () => {
  test('un editor no puede entrar a /admin', async () => {
    const agente = await entrar(EDITOR);
    const res = await agente.get('/admin').expect(403);
    assert.match(res.text, /solo para administradores/);
  });

  test('sin sesión redirige a /entrar', async () => {
    await request(app).get('/admin').expect(303).expect('Location', /^\/entrar/);
  });

  test('el admin crea un usuario que luego puede entrar', async () => {
    const agente = await entrar(ADMIN);
    const pagina = await agente.get('/admin').expect(200);
    await agente
      .post('/admin/usuarios')
      .type('form')
      .send({ _csrf: tokenDe(pagina.text), usuario: 'aprendiz.prueba', nombre: 'Aprendiz de Prueba', documento: '1.023.456.789', rol: 'editor', contrasena: 'otra-clave-123', repetir: 'otra-clave-123' })
      .expect(303);
    await entrar({ usuario: 'aprendiz.prueba', contrasena: 'otra-clave-123' });
    const mal = await agente
      .post('/admin/usuarios')
      .type('form')
      .send({ _csrf: tokenDe(pagina.text), usuario: 'x.y', nombre: 'X', contrasena: 'abcdefgh1', repetir: 'distinta12' })
      .expect(422);
    assert.match(mal.text, /no coinciden/);
  });

  test('el admin no puede desactivarse a sí mismo; desactivar a otro cierra sus sesiones y le impide entrar', async () => {
    const admin = await entrar(ADMIN);
    const victima = await entrar({ usuario: 'aprendiz.prueba', contrasena: 'otra-clave-123' });
    await victima.get('/registrar').expect(200);
    const pagina = await admin.get('/admin').expect(200);
    assert.match(pagina.text, /1023456789/); // el documento se ve solo en /admin
    const yo = prueba.db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(ADMIN.usuario).id;
    const otro = prueba.db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get('aprendiz.prueba').id;
    const propio = await admin.post(`/admin/usuarios/${yo}/desactivar`).type('form').send({ _csrf: tokenDe(pagina.text) }).expect(422);
    assert.match(propio.text, /No puedes desactivar tu propio usuario/);
    await admin.post(`/admin/usuarios/${otro}/desactivar`).type('form').send({ _csrf: tokenDe(pagina.text) }).expect(303);
    await victima.get('/registrar').expect(303).expect('Location', /^\/entrar/);
    const nuevo = request.agent(app);
    const form = await nuevo.get('/entrar');
    await nuevo.post('/entrar').type('form')
      .send({ _csrf: tokenDe(form.text), usuario: 'aprendiz.prueba', contrasena: 'otra-clave-123' }).expect(401);
    assert.ok(prueba.db.prepare('SELECT 1 FROM usuarios WHERE id = ?').get(otro), 'el usuario no se borra, se desactiva');
    await admin.post(`/admin/usuarios/${otro}/activar`).type('form').send({ _csrf: tokenDe(pagina.text) }).expect(303);
    await entrar({ usuario: 'aprendiz.prueba', contrasena: 'otra-clave-123' });
  });

  test('la meta del semestre cambia el panel', async () => {
    const agente = await entrar(ADMIN);
    const pagina = await agente.get('/admin').expect(200);
    await agente
      .post('/admin/config')
      .type('form')
      .send({ _csrf: tokenDe(pagina.text), meta_semestre: '72', nombre_sala: 'Sala de Sistemas', equipo: 'Ana Gómez\nLuis Pérez', instructor: 'Instructor Prueba' })
      .expect(303);
    const panel = await request(app).get('/api/panel').expect(200);
    assert.equal(panel.body.cifras.meta_semestre, 72);
    const proyecto = await request(app).get('/proyecto').expect(200);
    assert.match(proyecto.text, /Ana Gómez/);
    assert.match(proyecto.text, /Instructor Prueba/);
    const mala = await agente.post('/admin/config').type('form').send({ _csrf: tokenDe(pagina.text), meta_semestre: 'cien', nombre_sala: 'x' }).expect(422);
    assert.match(mala.text, /número entero/);
  });

  test('el respaldo descarga una base SQLite válida', async () => {
    const agente = await entrar(ADMIN);
    const res = await agente.get('/admin/respaldo').buffer(true).parse(binario).expect(200);
    assert.equal(res.body.subarray(0, 15).toString(), 'SQLite format 3');
  });

  test('limpiar demo exige la frase y nunca toca RAEE-0001', async () => {
    const agente = await entrar(ADMIN);
    const pagina = await agente.get('/admin').expect(200);
    const sinFrase = await agente.post('/admin/limpiar-demo').type('form').send({ _csrf: tokenDe(pagina.text), confirmar: 'si' }).expect(422);
    assert.match(sinFrase.text, /BORRAR DEMO/);
    assert.equal(prueba.db.prepare('SELECT COUNT(*) AS n FROM piezas WHERE demo = 1').get().n > 0, true);
    const real = prueba.db.prepare("SELECT * FROM piezas WHERE id = 'RAEE-0001'").get();

    await agente.post('/admin/limpiar-demo').type('form').send({ _csrf: tokenDe(pagina.text), confirmar: 'borrar demo' }).expect(303);
    assert.equal(prueba.db.prepare('SELECT COUNT(*) AS n FROM piezas WHERE demo = 1').get().n, 0);
    assert.deepEqual(prueba.db.prepare("SELECT * FROM piezas WHERE id = 'RAEE-0001'").get(), real);
    assert.equal(prueba.db.prepare("SELECT COUNT(*) AS n FROM movimientos WHERE pieza_id <> 'RAEE-0001'").get().n, 0);
    assert.equal(prueba.db.prepare("SELECT COUNT(*) AS n FROM etiquetas WHERE lote LIKE 'Lote 1%'").get().n > 0, true);
    const res = await request(app).get('/').expect(200);
    assert.doesNotMatch(res.text, /Incluye datos de demostración/);
  });
});

describe('página del proyecto', () => {
  test('/proyecto explica problema, solución, seguridad y marco legal', async () => {
    const res = await request(app).get('/proyecto').expect(200);
    for (const t of ['El problema', 'La solución', 'Seguridad de la información', 'Ley 1672 de 2013', 'Decreto 284 de 2018', 'Resolución 1512 de 2010', 'no se leyeron bien']) {
      assert.match(res.text, new RegExp(t));
    }
    assert.doesNotMatch(res.text, /CO₂|CO2/);
  });
});
