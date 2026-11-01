import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { crearApp } from '../src/app.js';
import { crearUsuario } from '../src/lib/auth.js';
import { crearDbPrueba } from './ayuda.js';

// Credenciales de prueba: solo existen en la base temporal de estas pruebas.
const USUARIO = { usuario: 'editor.prueba', nombre: 'Editor de Prueba', contrasena: 'clave-de-prueba-123' }; // registrador
const ADMIN = { usuario: 'admin.prueba', nombre: 'Admin de Prueba', contrasena: 'clave-de-prueba-321', rol: 'admin' };

let prueba;
let app;
let dirFotos;

sharp.cache(false); // en Windows, la caché de sharp deja los archivos abiertos

before(() => {
  prueba = crearDbPrueba();
  dirFotos = fs.mkdtempSync(path.join(os.tmpdir(), 'raee-fotos-'));
  crearUsuario(prueba.db, USUARIO, 4); // costo bajo solo para que las pruebas sean rápidas
  crearUsuario(prueba.db, ADMIN, 4);
  app = crearApp({ db: prueba.db, opciones: { sessionSecret: 'secreto-de-pruebas', fotosDir: dirFotos } });
});
after(() => {
  prueba.limpiar();
  fs.rmSync(dirFotos, { recursive: true, force: true });
});

const tokenDe = (html) => html.match(/name="_csrf" value="([^"]+)"/)?.[1];
const metaToken = (html) => html.match(/name="csrf-token" content="([^"]+)"/)?.[1];

async function entrar(aplicacion = app, quien = USUARIO) {
  const agente = request.agent(aplicacion);
  const form = await agente.get('/entrar').expect(200);
  await agente
    .post('/entrar')
    .type('form')
    .send({ _csrf: tokenDe(form.text), usuario: quien.usuario, contrasena: quien.contrasena, siguiente: '/' })
    .expect(303);
  return agente;
}

async function tokenRegistrar(agente) {
  const res = await agente.get('/registrar').expect(200);
  return tokenDe(res.text);
}

const piezaBase = {
  categoria_id: '2', estado: 'Funcional', destino: 'Banco de repuestos', ubicacion: 'S1-E1',
  marca: 'Kingston', modelo_pn: 'KVR16N11/4', descripcion: 'DDR3 4 GB 1600 MHz',
};
const movimientos = (id) => prueba.db.prepare('SELECT * FROM movimientos WHERE pieza_id = ? ORDER BY id').all(id);

// --- Acceso ---------------------------------------------------------------------------------

describe('acceso', () => {
  test('editar sin sesión redirige a /entrar', async () => {
    await request(app).get('/registrar').expect(303).expect('Location', '/entrar?siguiente=%2Fregistrar');
    await request(app).get('/movimiento').expect(303).expect('Location', /^\/entrar/);
    await request(app).get('/p/RAEE-0010/editar').expect(303).expect('Location', /^\/entrar/);
  });

  test('la API de cambios sin sesión responde 401 en JSON', async () => {
    const res = await request(app).post('/api/piezas/RAEE-0022/movimiento').send({ campo: 'estado', valor: 'Funcional' });
    // sin sesión tampoco hay token: lo que llega primero es el rechazo de CSRF o de sesión
    assert.ok([401, 403].includes(res.status));
  });

  test('POST sin token CSRF: 403 con mensaje amable', async () => {
    const res = await request(app).post('/entrar').type('form').send({ usuario: 'x', contrasena: 'y' }).expect(403);
    assert.match(res.text, /La página caducó/);
    const agente = await entrar();
    await agente.post('/registrar').type('form').send(piezaBase).expect(403);
  });

  test('contraseña incorrecta: 401 sin decir cuál dato falló', async () => {
    const agente = request.agent(app);
    const form = await agente.get('/entrar');
    const res = await agente.post('/entrar').type('form')
      .send({ _csrf: tokenDe(form.text), usuario: USUARIO.usuario, contrasena: 'equivocada' }).expect(401);
    assert.match(res.text, /Usuario o contraseña incorrectos/);
  });

  test('máximo 5 intentos fallidos cada 15 minutos', async () => {
    const otra = crearApp({ db: prueba.db, opciones: { sessionSecret: 's', fotosDir: dirFotos } });
    const agente = request.agent(otra);
    for (let i = 0; i < 5; i++) {
      const form = await agente.get('/entrar');
      await agente.post('/entrar').type('form').send({ _csrf: tokenDe(form.text), usuario: 'nadie', contrasena: 'mal' }).expect(401);
    }
    const form = await agente.get('/entrar');
    const res = await agente.post('/entrar').type('form').send({ _csrf: tokenDe(form.text), usuario: 'nadie', contrasena: 'mal' }).expect(429);
    assert.match(res.text, /Demasiados intentos/);
  });

  test('entrar lleva a la página pedida y no a sitios externos', async () => {
    const agente = request.agent(app);
    const form = await agente.get('/entrar?siguiente=/registrar');
    await agente.post('/entrar').type('form')
      .send({ _csrf: tokenDe(form.text), usuario: USUARIO.usuario, contrasena: USUARIO.contrasena, siguiente: '//sitio-malo.com' })
      .expect(303).expect('Location', '/');
  });

  test('salir cierra la sesión', async () => {
    const agente = await entrar();
    const inicio = await agente.get('/').expect(200);
    assert.match(inicio.text, /Editor de Prueba/);
    await agente.post('/salir').type('form').send({ _csrf: tokenDe(inicio.text) }).expect(303);
    await agente.get('/registrar').expect(303).expect('Location', /^\/entrar/);
  });
});

// --- Registro ---------------------------------------------------------------------------------

describe('registro', () => {
  test('flujo a: registrar RAEE-0037 escaneando su etiqueta preimpresa', async () => {
    const agente = await entrar();
    const _csrf = await tokenRegistrar(agente);
    await agente.post('/registrar').type('form').send({ ...piezaBase, _csrf, id: 'RAEE-0037', serial: 'T-0037' })
      .expect(303).expect('Location', '/p/RAEE-0037');

    const pieza = prueba.db.prepare('SELECT * FROM piezas WHERE id = ?').get('RAEE-0037');
    assert.equal(pieza.demo, 0);
    assert.equal(pieza.estado, 'Funcional');
    const movs = movimientos('RAEE-0037');
    assert.equal(movs.length, 1);
    assert.equal(movs[0].tipo, 'registro');
    assert.equal(movs[0].usuario, USUARIO.usuario);
    // La etiqueta preimpresa sigue siendo del lote 1 (formato ID)
    assert.equal(prueba.db.prepare('SELECT formato FROM etiquetas WHERE id = ?').get('RAEE-0037').formato, 'ID');

    const ficha = await agente.get('/p/RAEE-0037').expect(200);
    assert.match(ficha.text, /Pieza RAEE-0037 registrada/);
    assert.match(ficha.text, /Movimiento rápido/);
    assert.doesNotMatch(ficha.text, /Editar todo/); // el registrador no edita todo
  });

  test('el ID escaneado como enlace o en minúsculas también sirve', async () => {
    const agente = await entrar();
    const _csrf = await tokenRegistrar(agente);
    await agente.post('/registrar').type('form')
      .send({ ...piezaBase, _csrf, id: 'https://raee.smarteksoft.com/p/raee-38', serial: 'T-0038' })
      .expect(303).expect('Location', '/p/RAEE-0038');
  });

  test('flujo b: sin ID se asigna el siguiente libre y se reserva su etiqueta', async () => {
    const agente = await entrar();
    const form = await agente.get('/registrar');
    const esperado = form.text.match(/se asignará <strong class="mono">(RAEE-\d{4})<\/strong>/)[1];
    assert.equal(esperado, 'RAEE-0049'); // el lote 1 llega a la 0048
    await agente.post('/registrar').type('form').send({ ...piezaBase, _csrf: tokenDe(form.text), id: '', serial: 'T-AUTO' })
      .expect(303).expect('Location', '/p/RAEE-0049');
    const etiqueta = prueba.db.prepare('SELECT * FROM etiquetas WHERE id = ?').get('RAEE-0049');
    assert.equal(etiqueta.formato, 'URL');
    const ficha = await agente.get('/p/RAEE-0049');
    assert.match(ficha.text, /Imprime su etiqueta/);
  });

  test('con sesión, una etiqueta sin pieza abre Registrar con el ID puesto', async () => {
    const agente = await entrar();
    await agente.get('/p/RAEE-0040').expect(303).expect('Location', '/registrar?id=RAEE-0040');
    const form = await agente.get('/registrar?id=RAEE-0040').expect(200);
    assert.match(form.text, /value="RAEE-0040"/);
  });

  test('un ID ya registrado se rechaza', async () => {
    const agente = await entrar();
    const _csrf = await tokenRegistrar(agente);
    const res = await agente.post('/registrar').type('form').send({ ...piezaBase, _csrf, id: 'RAEE-0010' }).expect(422);
    assert.match(res.text, /RAEE-0010 ya está registrada/);
  });

  test('serial repetido: mensaje claro con la pieza que ya lo tiene', async () => {
    const agente = await entrar();
    const _csrf = await tokenRegistrar(agente);
    const res = await agente.post('/registrar').type('form').send({ ...piezaBase, _csrf, id: 'RAEE-0041', serial: 'UYRL81507803' }).expect(422);
    assert.match(res.text, /Ese serial ya está registrado en RAEE-0001/);
    assert.equal(prueba.db.prepare('SELECT 1 FROM piezas WHERE id = ?').get('RAEE-0041'), undefined);
  });

  test('campos obligatorios: categoría, estado, destino y ubicación', async () => {
    const agente = await entrar();
    const _csrf = await tokenRegistrar(agente);
    const res = await agente.post('/registrar').type('form').send({ _csrf, id: 'RAEE-0042' }).expect(422);
    for (const m of ['Elige la categoría', 'Elige el estado', 'Elige el destino', 'Elige dónde queda guardada']) assert.match(res.text, new RegExp(m));
  });

  test('un disco exige indicar el borrado seguro y no puede donarse sin él', async () => {
    const agente = await entrar();
    let _csrf = await tokenRegistrar(agente);
    const disco = { ...piezaBase, categoria_id: '3', destino: 'Pendiente', id: 'RAEE-0043', serial: 'T-DISCO' };
    let res = await agente.post('/registrar').type('form').send({ ...disco, _csrf }).expect(422);
    assert.match(res.text, /Indica si ya se hizo el borrado seguro/);
    _csrf = await tokenRegistrar(agente);
    res = await agente.post('/registrar').type('form').send({ ...disco, _csrf, borrado_seguro: 'No', destino: 'Donación' }).expect(422);
    assert.match(res.text, /Este disco puede contener información de la institución/);
  });

  test('reutilizada en la sala exige el equipo', async () => {
    const agente = await entrar();
    const _csrf = await tokenRegistrar(agente);
    const res = await agente.post('/registrar').type('form')
      .send({ ...piezaBase, _csrf, id: 'RAEE-0044', destino: 'Reutilizada en la sala' }).expect(422);
    assert.match(res.text, /Escribe el equipo donde se instaló/);
  });
});

// --- Movimiento rápido (criterio de aceptación: donar RAEE-0014) --------------------------------

describe('movimiento rápido', () => {
  async function api(agente, id, cuerpo) {
    const pagina = await agente.get('/movimiento').expect(200);
    return agente.post(`/api/piezas/${id}/movimiento`).set('x-csrf-token', metaToken(pagina.text)).send(cuerpo);
  }

  test('intentar donar RAEE-0014 muestra el aviso de borrado seguro y no cambia nada', async () => {
    const agente = await entrar();
    const antes = movimientos('RAEE-0014').length;
    const res = await api(agente, 'RAEE-0014', { campo: 'destino', valor: 'Donación' });
    assert.equal(res.status, 422);
    assert.equal(res.body.codigo, 'BORRADO_SEGURO');
    assert.match(res.body.mensaje, /Este disco puede contener información de la institución/);
    assert.equal(prueba.db.prepare('SELECT destino FROM piezas WHERE id = ?').get('RAEE-0014').destino, 'Pendiente');
    assert.equal(movimientos('RAEE-0014').length, antes);
  });

  test('marcar el borrado seguro y después donar: se permite y queda en el historial', async () => {
    const agente = await entrar();
    let res = await api(agente, 'RAEE-0014', { campo: 'borrado_seguro', valor: 'Sí' });
    assert.equal(res.status, 200);
    res = await api(agente, 'RAEE-0014', { campo: 'destino', valor: 'Donación' });
    assert.equal(res.status, 200);
    assert.equal(res.body.pieza.destino, 'Donación');
    const tipos = movimientos('RAEE-0014').slice(-2).map((m) => [m.tipo, m.valor_nuevo, m.usuario]);
    assert.deepEqual(tipos, [['borrado_seguro', 'Sí', USUARIO.usuario], ['destino', 'Donación', USUARIO.usuario]]);
  });

  test('reutilizar RAEE-0022 en PC-15: pide el equipo y luego registra el destino', async () => {
    const agente = await entrar();
    let res = await api(agente, 'RAEE-0022', { campo: 'destino', valor: 'Reutilizada en la sala' });
    assert.equal(res.status, 422);
    assert.equal(res.body.codigo, 'FALTA_EQUIPO');
    res = await api(agente, 'RAEE-0022', { campo: 'destino', valor: 'Reutilizada en la sala', equipo_destino: 'pc-15' });
    assert.equal(res.status, 200);
    assert.equal(res.body.pieza.equipo_destino, 'PC-15');
    assert.match(res.body.pieza.impacto.texto, /Volvió a la vida en el equipo PC-15/);
    const ultimo = movimientos('RAEE-0022').at(-1);
    assert.equal(ultimo.tipo, 'destino');
    assert.equal(ultimo.valor_nuevo, 'Reutilizada en la sala → PC-15');
  });

  test('cambiar estado y ubicación deja un movimiento legible', async () => {
    const agente = await entrar();
    let res = await api(agente, 'RAEE-0007', { campo: 'estado', valor: 'Funcional' });
    assert.equal(res.status, 200);
    res = await api(agente, 'RAEE-0007', { campo: 'ubicacion', valor: 'S1-E1' });
    assert.equal(res.status, 200);
    const [estado, ubicacion] = movimientos('RAEE-0007').slice(-2);
    assert.deepEqual([estado.tipo, estado.valor_anterior, estado.valor_nuevo], ['estado', 'Por probar', 'Funcional']);
    assert.deepEqual([ubicacion.tipo, ubicacion.valor_anterior, ubicacion.valor_nuevo], ['ubicacion', 'Sala 1 · Caja 2', 'Sala 1 · Estante A1']);
  });

  test('valores fuera del catálogo y borrado en piezas que no son discos se rechazan', async () => {
    const agente = await entrar();
    let res = await api(agente, 'RAEE-0007', { campo: 'estado', valor: 'Inventado' });
    assert.equal(res.status, 422);
    res = await api(agente, 'RAEE-0007', { campo: 'borrado_seguro', valor: 'Sí' });
    assert.equal(res.status, 422);
    res = await api(agente, 'RAEE-0007', { campo: 'notas', valor: 'x' });
    assert.equal(res.status, 422);
  });

  test('con sesión la API muestra notas y usuarios; sin sesión no', async () => {
    const agente = await entrar();
    const privado = await agente.get('/api/piezas/RAEE-0010').expect(200);
    assert.match(privado.body.pieza.notas, /DBAN/);
    assert.ok(privado.body.historial.some((m) => m.usuario));
    const publico = await request(app).get('/api/piezas/RAEE-0010').expect(200);
    assert.ok(!('notas' in publico.body.pieza));
  });
});

// --- Editar y foto ------------------------------------------------------------------------------

describe('editar', () => {
  async function formEditar(agente, id) {
    const res = await agente.get(`/p/${id}/editar`).expect(200);
    return tokenDe(res.text);
  }
  const datosDe = (id) => {
    const p = prueba.db.prepare('SELECT * FROM piezas WHERE id = ?').get(id);
    return Object.fromEntries(
      ['categoria_id', 'marca', 'modelo_pn', 'serial', 'descripcion', 'estado', 'destino', 'ubicacion', 'equipo_destino', 'borrado_seguro', 'fecha_ingreso']
        .map((k) => [k, p[k] == null ? '' : String(p[k])]),
    );
  };

  test('editar campos genera movimientos por tipo de cambio', async () => {
    const agente = await entrar(app, ADMIN);
    const _csrf = await formEditar(agente, 'RAEE-0030');
    const datos = { ...datosDe('RAEE-0030'), marca: 'Marca Corregida', estado: 'Dañado' };
    await agente.post('/p/RAEE-0030/editar').field({ ...datos, _csrf }).expect(303).expect('Location', '/p/RAEE-0030');
    const ultimos = movimientos('RAEE-0030').slice(-2).map((m) => m.tipo);
    assert.deepEqual(ultimos, ['estado', 'edicion']);
    assert.equal(prueba.db.prepare('SELECT marca FROM piezas WHERE id = ?').get('RAEE-0030').marca, 'Marca Corregida');
  });

  test('subir una foto la convierte a WebP y la muestra en la ficha', async () => {
    const agente = await entrar(app, ADMIN);
    const _csrf = await formEditar(agente, 'RAEE-0031');
    const png = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#1f7a6b' } }).png().toBuffer();
    await agente.post('/p/RAEE-0031/editar').field({ ...datosDe('RAEE-0031'), _csrf, foto_enviada: '1' })
      .attach('foto', png, { filename: 'pieza.png', contentType: 'image/png' })
      .expect(303);
    const { foto } = prueba.db.prepare('SELECT foto FROM piezas WHERE id = ?').get('RAEE-0031');
    assert.match(foto, /^RAEE-0031-\d+\.webp$/);
    const meta = await sharp(path.join(dirFotos, foto)).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.width, 1200);
    const ficha = await request(app).get('/p/RAEE-0031');
    assert.match(ficha.text, new RegExp(`src="/fotos/${foto}"`));
    await request(app).get(`/fotos/${foto}`).expect(200).expect('Content-Type', /webp/);
  });

  test('un archivo que no es imagen se rechaza', async () => {
    const agente = await entrar(app, ADMIN);
    const _csrf = await formEditar(agente, 'RAEE-0032');
    const res = await agente.post('/p/RAEE-0032/editar').field({ ...datosDe('RAEE-0032'), _csrf, foto_enviada: '1' })
      .attach('foto', Buffer.from('esto no es una imagen'), { filename: 'falsa.png', contentType: 'image/png' })
      .expect(422);
    assert.match(res.text, /no es una imagen válida/);
  });

  test('el formulario con foto también exige el token CSRF', async () => {
    const agente = await entrar(app, ADMIN);
    await agente.post('/p/RAEE-0032/editar').field({ ...datosDe('RAEE-0032') }).expect(403);
  });

  test('editar un disco a donación sin borrado se bloquea con el aviso', async () => {
    const agente = await entrar(app, ADMIN);
    const _csrf = await formEditar(agente, 'RAEE-0017');
    const res = await agente.post('/p/RAEE-0017/editar').field({ ...datosDe('RAEE-0017'), _csrf, destino: 'Donación' }).expect(422);
    assert.match(res.text, /Este disco puede contener información de la institución/);
    assert.equal(prueba.db.prepare('SELECT destino FROM piezas WHERE id = ?').get('RAEE-0017').destino, 'Pendiente');
  });
});

test('RAEE-0001 (registro real) no se modificó en ninguna prueba', () => {
  const p = prueba.db.prepare('SELECT actualizado_en FROM piezas WHERE id = ?').get('RAEE-0001');
  assert.equal(p.actualizado_en, '2026-10-19 09:00:00');
  assert.equal(movimientos('RAEE-0001').length, 1);
});
