import { Router } from 'express';
import { extraerId } from '../lib/escaneo.js';
import { buscarPorId } from '../lib/piezas.js';
import { catalogos, leerFiltros, hayFiltros, buscarPiezas, urlBusqueda } from '../lib/busqueda.js';
import { cifrasPanel } from '../lib/panel.js';
import { kg } from '../lib/formato.js';
import { libroInventario } from '../lib/excel.js';
import { hoyLocal } from '../lib/validacion.js';
import { leerConfig } from '../lib/admin.js';
import { emitirA } from '../lib/eventos.js';
import { mapaUbicaciones, obtenerUbicacion, ubicacionDePieza } from '../lib/ubicaciones.js';

export function rutasPublicas({ db, ajustes = {} }) {
  const r = Router();

  r.get('/', (req, res) => {
    const cifras = cifrasPanel(db);
    res.render('portada', { titulo: 'Inicio', cifras, kgTexto: kg(cifras.kg_inventariados) });
  });

  r.get('/proyecto', (req, res) => {
    res.render('proyecto', { titulo: 'Sobre el proyecto', config: leerConfig(db) });
  });

  r.get('/consulta', (req, res) => {
    res.render('consulta', { titulo: 'Consulta por escaneo', modoKiosco: true });
  });

  // Formulario "Ver ficha" (portada y páginas de error): funciona también sin JavaScript.
  r.get('/ir', (req, res) => {
    const texto = typeof req.query.id === 'string' ? req.query.id : '';
    const { id } = extraerId(texto);
    res.redirect(303, `/p/${encodeURIComponent(id ?? (texto.trim() || 'vacio'))}`);
  });

  // Ficha de la pieza. Acepta variantes ("raee-10") y redirige a la forma canónica.
  r.get('/p/:id', (req, res) => {
    const { id, error } = extraerId(req.params.id);
    if (error) {
      return res.status(404).render('ficha-no-encontrada', {
        titulo: 'No está en el inventario',
        idBuscado: req.params.id,
        resultado: 'no_existe',
      });
    }
    if (id !== req.params.id) return res.redirect(301, `/p/${id}`);

    const editor = Boolean(req.session?.usuario);
    const datos = buscarPorId(db, id, { privado: editor });
    // Escáner con el celular: si quien tiene sesión abre la etiqueta (cámara del celular), su PC
    // la recibe como si la hubiera leído un lector. Las recargas en vivo de la ficha no cuentan.
    if (editor && esNavegacion(req)) {
      emitirA(req.session.usuario.id, 'escaneo', { id });
    }
    if (datos.resultado === 'registrada') {
      return res.render('ficha', { titulo: `${datos.pieza.id} · ${datos.pieza.categoria}`, ...datos });
    }
    const sinRegistrar = datos.resultado === 'sin_registrar';
    // §6.3: con sesión, una etiqueta preimpresa sin pieza abre Registrar con el ID ya puesto.
    if (sinRegistrar && editor) return res.redirect(303, `/registrar?id=${id}`);
    res.status(sinRegistrar ? 200 : 404).render('ficha-no-encontrada', {
      titulo: sinRegistrar ? 'Etiqueta sin registrar' : 'No está en el inventario',
      idBuscado: id,
      ...datos,
    });
  });

  // Búsqueda por componente. Los filtros viajan en la URL para poder compartirla.
  r.get('/buscar', (req, res) => {
    const cat = catalogos(db);
    const filtros = leerFiltros(req.query, cat);
    const { piezas, recortado } = buscarPiezas(db, filtros);
    res.render('buscar', {
      titulo: filtros.q ? `Buscar «${filtros.q}»` : 'Buscar',
      cat,
      filtros,
      piezas,
      recortado,
      conFiltros: hayFiltros(filtros),
      urlBusqueda: (cambios) => urlBusqueda(filtros, cambios),
    });
  });

  // Exportar a Excel (plan B): mismos filtros que /buscar. Sin sesión no van las notas internas.
  r.get('/exportar.xlsx', async (req, res, next) => {
    try {
      const filtros = leerFiltros(req.query, catalogos(db));
      const { libro } = await libroInventario(db, filtros, { privado: Boolean(req.session?.usuario), baseUrl: ajustes.baseUrl });
      const nombre = `Inventario_RAEE_${hoyLocal()}${hayFiltros(filtros) ? '_filtrado' : ''}.xlsx`;
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        'Cache-Control': 'no-store',
      });
      await libro.xlsx.write(res);
      res.end();
    } catch (err) {
      next(err);
    }
  });

  // Mapa de la sala. ?resaltar=RAEE-0010 ilumina el lugar donde está esa pieza.
  r.get('/ubicaciones', (req, res) => {
    const { id } = extraerId(typeof req.query.resaltar === 'string' ? req.query.resaltar : '');
    const resaltada = id ? ubicacionDePieza(db, id) : null;
    res.render('ubicaciones', {
      titulo: 'Mapa de ubicaciones',
      ...mapaUbicaciones(db),
      resaltada,
      idResaltado: id ?? null,
    });
  });

  r.get('/ubicaciones/:codigo', (req, res) => {
    const lugar = obtenerUbicacion(db, req.params.codigo.toUpperCase());
    if (!lugar) {
      return res.status(404).render('error', {
        titulo: 'Ubicación no encontrada',
        icono: '📍',
        mensaje: 'Esa ubicación no existe en la sala.',
      });
    }
    if (lugar.codigo !== req.params.codigo) return res.redirect(301, `/ubicaciones/${lugar.codigo}`);
    const { piezas } = buscarPiezas(db, { ubicacion: lugar.codigo });
    res.render('ubicacion', { titulo: lugar.nombre, lugar, piezas });
  });

  return r;
}

// Navegación real (abrir el enlace del QR), no una petición fetch de la propia página.
function esNavegacion(req) {
  if (req.get('x-refresco')) return false;
  const modo = req.get('sec-fetch-mode');
  return !modo || modo === 'navigate';
}
