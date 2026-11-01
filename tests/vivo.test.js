// Fase 5: panel de impacto, canal en vivo (SSE) y escenario /demo.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { crearUsuario } from '../src/lib/auth.js';
import { cifrasPanel } from '../src/lib/panel.js';
import { crearDbPrueba } from './ayuda.js';

const USUARIO = { usuario: 'editor.vivo', nombre: 'Editor en Vivo', contrasena: 'clave-de-prueba-456' };

let prueba;
let app;
let servidor;
let puerto;

before(async () => {
  prueba = crearDbPrueba();
  crearUsuario(prueba.db, USUARIO, 4);
  app = crearApp({ db: prueba.db, opciones: { sessionSecret: 'secreto-de-pruebas' } });
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
const metaToken = (html) => html.match(/name="csrf-token" content="([^"]+)"/)?.[1];

async function entrar() {
  const agente = request.agent(servidor);
  const form = await agente.get('/entrar').expect(200);
  await agente
    .post('/entrar')
    .type('form')
    .send({ _csrf: tokenDe(form.text), usuario: USUARIO.usuario, contrasena: USUARIO.contrasena, siguiente: '/' })
    .expect(303);
  return agente;
}

// Abre /eventos y junta los eventos que llegan.
function abrirCanal() {
  return new Promise((ok, falla) => {
    const eventos = [];
    const req = http.get({ host: '127.0.0.1', port: puerto, path: '/eventos' }, (res) => {
      let bufer = '';
      res.setEncoding('utf8');
      res.on('data', (trozo) => {
        bufer += trozo;
        let corte;
        while ((corte = bufer.indexOf('\n\n')) !== -1) {
          const bloque = bufer.slice(0, corte);
          bufer = bufer.slice(corte + 2);
          const tipo = bloque.match(/^event: (.+)$/m)?.[1];
          const datos = bloque.match(/^data: (.+)$/m)?.[1];
          if (tipo) eventos.push({ tipo, datos: JSON.parse(datos), crudo: bloque });
        }
      });
      ok({ res, eventos, cerrar: () => req.destroy() });
    });
    req.on('error', falla);
  });
}

const esperar = async (condicion, ms = 2000) => {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    if (condicion()) return true;
    await new Promise((ok) => setTimeout(ok, 20));
  }
  return false;
};

describe('panel de impacto', () => {
  test('las cifras de /api/panel coinciden con SELECT * FROM v_panel', async () => {
    const v = prueba.db.prepare('SELECT * FROM v_panel').get();
    const res = await request(app).get('/api/panel').expect(200);
    for (const [clave, valor] of Object.entries(v)) {
      assert.equal(res.body.cifras[clave], valor ?? (clave === 'pct_no_va_a_basura' ? 0 : valor), clave);
    }
    assert.equal(res.body.cifras.piezas_registradas, 36);
  });

  test('/panel muestra las cifras con rótulos honestos y los tres gráficos', async () => {
    const v = cifrasPanel(prueba.db);
    const res = await request(app).get('/panel').expect(200);
    assert.match(res.text, /Kg inventariados/);
    assert.match(res.text, /Kg con destino final/);
    assert.match(res.text, /Pesos medidos/);
    assert.match(res.text, /Discos con borrado seguro/);
    assert.match(res.text, new RegExp(`data-cifra="piezas_registradas" data-valor="${v.piezas_registradas}"`));
    for (const id of ['g-categoria', 'g-destino', 'g-estado']) assert.match(res.text, new RegExp(`id="${id}"`));
    assert.match(res.text, /\/vendor\/chart\.umd\.min\.js/);
  });

  test('/panel?tv=1 es la versión de proyector: sin menú', async () => {
    const res = await request(app).get('/panel?tv=1').expect(200);
    assert.match(res.text, /class="[^"]*\btv\b/);
    assert.doesNotMatch(res.text, /<nav aria-label="Principal">/);
  });

  test('los últimos movimientos públicos no muestran usuarios', async () => {
    const res = await request(app).get('/api/panel').expect(200);
    assert.ok(res.body.movimientos.length > 0);
    for (const m of res.body.movimientos) {
      assert.equal(m.usuario, undefined);
      assert.equal(m.nota, undefined);
    }
  });

  test('Chart.js se sirve desde el propio servidor (sin CDN)', async () => {
    const res = await request(app).get('/vendor/chart.umd.min.js').expect(200);
    assert.match(res.text.slice(0, 200), /Chart\.js/);
  });

  test('la portada muestra 3 cifras del panel', async () => {
    const res = await request(app).get('/').expect(200);
    assert.match(res.text, /Piezas registradas/);
    assert.match(res.text, /Kg inventariados/);
    assert.match(res.text, /Reutilizadas en la sala/);
    assert.match(res.text, /href="\/panel"/);
  });
});

describe('canal en vivo /eventos', () => {
  test('responde text/event-stream', async () => {
    const canal = await abrirCanal();
    assert.match(canal.res.headers['content-type'], /^text\/event-stream/);
    assert.equal(canal.res.headers['cache-control'], 'no-cache, no-transform');
    assert.ok(await esperar(() => canal.eventos.some((e) => e.tipo === 'hola')));
    canal.cerrar();
  });

  test('un movimiento emite el evento correspondiente, sin notas ni usuario', async () => {
    prueba.db.prepare("UPDATE piezas SET notas = 'nota-secreta-interna' WHERE id = 'RAEE-0022'").run();
    const canal = await abrirCanal();
    const agente = await entrar();
    const pagina = await agente.get('/movimiento').expect(200);
    const inicio = Date.now();
    await agente
      .post('/api/piezas/RAEE-0022/movimiento')
      .set('x-csrf-token', metaToken(pagina.text))
      .send({ campo: 'destino', valor: 'Reutilizada en la sala', equipo_destino: 'pc-15' })
      .expect(200);
    assert.ok(await esperar(() => canal.eventos.some((e) => e.tipo === 'movimiento')), 'no llegó el evento');
    assert.ok(Date.now() - inicio < 2000, 'el evento debe llegar en menos de 2 s');
    const ev = canal.eventos.find((e) => e.tipo === 'movimiento');
    assert.deepEqual(Object.keys(ev.datos).sort(), ['categoria', 'icono', 'icono_categoria', 'pieza_id', 'tipo', 'valor_nuevo']);
    assert.equal(ev.datos.pieza_id, 'RAEE-0022');
    assert.equal(ev.datos.tipo, 'destino');
    assert.equal(ev.datos.icono, '🌱');
    assert.equal(ev.datos.valor_nuevo, 'Reutilizada en la sala → PC-15');
    assert.doesNotMatch(ev.crudo, /nota-secreta-interna/);
    assert.doesNotMatch(ev.crudo, new RegExp(USUARIO.usuario));
    canal.cerrar();
  });

  test('un cambio rechazado (disco sin borrado) no emite evento', async () => {
    const canal = await abrirCanal();
    const agente = await entrar();
    const pagina = await agente.get('/movimiento').expect(200);
    await agente
      .post('/api/piezas/RAEE-0014/movimiento')
      .set('x-csrf-token', metaToken(pagina.text))
      .send({ campo: 'destino', valor: 'Donación' })
      .expect(422);
    await new Promise((ok) => setTimeout(ok, 150));
    assert.equal(canal.eventos.filter((e) => e.tipo === 'movimiento').length, 0);
    canal.cerrar();
  });

  test('tras el cambio, el panel sube la cifra de reutilizadas', async () => {
    const res = await request(app).get('/api/panel').expect(200);
    assert.equal(res.body.cifras.reutilizadas_en_sala, prueba.db.prepare('SELECT reutilizadas_en_sala AS n FROM v_panel').get().n);
    assert.equal(res.body.movimientos[0].pieza_id, 'RAEE-0022');
  });
});

describe('escenario /demo', () => {
  test('sin sesión redirige a /entrar', async () => {
    await request(app).get('/demo').expect(303).expect('Location', /^\/entrar/);
  });

  test('con sesión muestra las tres columnas', async () => {
    const agente = await entrar();
    const res = await agente.get('/demo').expect(200);
    assert.match(res.text, /Escanea y cambia/);
    assert.match(res.text, /Lo que ve quien escanea/);
    assert.match(res.text, /Panel en vivo/);
    assert.ok(metaToken(res.text));
  });

  test('la ficha incluye el script de actualización en vivo', async () => {
    const res = await request(app).get('/p/RAEE-0010').expect(200);
    assert.match(res.text, /data-pieza="RAEE-0010"/);
    assert.match(res.text, /\/js\/ficha\.js/);
  });
});
