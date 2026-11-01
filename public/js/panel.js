// /panel y /panel?tv=1: gráficos (Chart.js servido desde el propio servidor) y cifras en vivo.
import { escucharEventos, pintarEstado, mostrarAviso } from './vivo.js';
import { pedirPanel, actualizarCifras, pintarUltimos } from './panel-vivo.js';

const Chart = window.Chart;
const tv = document.querySelector('.panel-tv') !== null;
const datos = JSON.parse(document.getElementById('datos-panel').textContent);
const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const COLOR_TEXTO = '#1d2a28';
const COLOR_REJILLA = '#d9e3df';
const letra = tv ? 18 : 13;

const graficos = {};
if (Chart) {
  Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  Chart.defaults.font.size = letra;
  Chart.defaults.color = COLOR_TEXTO;
  Chart.defaults.animation = sinMovimiento ? false : { duration: 700 };
  Chart.defaults.maintainAspectRatio = false;

  graficos.categoria = new Chart(document.getElementById('g-categoria'), {
    type: 'bar',
    data: {
      labels: datos.porCategoria.map((g) => `${g.icono} ${g.nombre}`),
      datasets: [{ data: datos.porCategoria.map((g) => g.n), backgroundColor: '#1f7a6b', borderRadius: 6 }],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: COLOR_REJILLA } }, y: { grid: { display: false } } },
    },
  });

  graficos.destino = new Chart(document.getElementById('g-destino'), {
    type: 'doughnut',
    data: {
      labels: datos.porDestino.map((g) => g.nombre),
      datasets: [{ data: datos.porDestino.map((g) => g.n), backgroundColor: datos.porDestino.map((g) => g.color), borderColor: '#fff', borderWidth: 2 }],
    },
    options: { cutout: '58%', plugins: { legend: { position: 'bottom', labels: { boxWidth: letra, padding: 10 } } } },
  });

  graficos.estado = new Chart(document.getElementById('g-estado'), {
    type: 'bar',
    data: {
      labels: datos.porEstado.map((g) => g.nombre),
      datasets: [{ data: datos.porEstado.map((g) => g.n), backgroundColor: datos.porEstado.map((g) => g.color), borderRadius: 6 }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: COLOR_REJILLA } }, x: { grid: { display: false } } },
    },
  });
}

function actualizarGraficos(g) {
  if (!Chart) return;
  const poner = (grafico, filas, etiqueta) => {
    grafico.data.labels = filas.map(etiqueta);
    grafico.data.datasets[0].data = filas.map((f) => f.n);
    grafico.update();
  };
  poner(graficos.categoria, g.porCategoria, (f) => `${f.icono} ${f.nombre}`);
  poner(graficos.destino, g.porDestino, (f) => f.nombre);
  poner(graficos.estado, g.porEstado, (f) => f.nombre);
}

// Varios movimientos seguidos (p. ej. borrado + destino) se agrupan en una sola consulta.
let pendiente = null;
function refrescar() {
  clearTimeout(pendiente);
  pendiente = setTimeout(async () => {
    try {
      const d = await pedirPanel();
      actualizarCifras(d.cifras);
      actualizarGraficos(d.graficos);
      pintarUltimos(document.getElementById('ultimos'), d.movimientos);
    } catch (err) {
      console.error('[panel]', err);
    }
  }, 150);
}

escucharEventos({
  alEstado: pintarEstado,
  alMovimiento(ev) {
    mostrarAviso(document.getElementById('avisos-vivo'), ev);
    refrescar();
  },
});
