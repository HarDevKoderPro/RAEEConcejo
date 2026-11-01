// Formulario de pieza (Registrar y Editar). Todo funciona también sin JavaScript: el servidor
// valida de nuevo; aquí solo se ayuda a quien llena el formulario.
const form = document.getElementById('form-pieza');
const $ = (id) => document.getElementById(id);

const categoria = $('categoria_id');
const destino = $('destino');
const ayudaCategoria = $('ayuda-categoria');
const campoBorrado = $('campo-borrado');
const campoEquipo = $('campo-equipo');
const ayudaPeso = $('ayuda-peso');
const MENSAJE_BORRADO =
  'Este disco puede contener información de la institución. Haz el borrado seguro y márcalo antes de darle este destino.';

const kg = (n) => `${Number(n).toLocaleString('es-CO', { maximumFractionDigits: 3 })} kg`;

function alCambiarCategoria() {
  const op = categoria.selectedOptions[0];
  const elegida = op && op.value;
  ayudaCategoria.hidden = !elegida;
  if (elegida) {
    ayudaCategoria.textContent = op.dataset.guia ? `Anota: ${op.dataset.guia}. Peso estimado: ${kg(op.dataset.peso)}.` : `Peso estimado: ${kg(op.dataset.peso)}.`;
    ayudaPeso.textContent = `Déjalo vacío si no la pesaste: se usará el estimado (${kg(op.dataset.peso)}).`;
  }
  campoBorrado.hidden = !(elegida && op.dataset.borrado === '1');
  revisarBorrado();
}

function alCambiarDestino() {
  const reutilizada = destino.value === 'Reutilizada en la sala';
  campoEquipo.hidden = !reutilizada;
  if (reutilizada && !$('equipo_destino').value) $('equipo_destino').focus();
  revisarBorrado();
}

// Aviso inmediato de la regla de borrado seguro (el servidor y la base la imponen igual).
let avisoBorrado = null;
function revisarBorrado() {
  const esDisco = !campoBorrado.hidden;
  const terceros = destino.selectedOptions[0]?.dataset.terceros === '1';
  const borrado = form.querySelector('input[name="borrado_seguro"]:checked')?.value;
  const bloqueado = esDisco && terceros && borrado !== 'Sí';
  if (bloqueado && !avisoBorrado) {
    avisoBorrado = document.createElement('p');
    avisoBorrado.className = 'campo-aviso';
    avisoBorrado.setAttribute('role', 'alert');
    avisoBorrado.textContent = `🔒 ${MENSAJE_BORRADO}`;
    destino.closest('.campo').append(avisoBorrado);
  } else if (!bloqueado && avisoBorrado) {
    avisoBorrado.remove();
    avisoBorrado = null;
  }
}

categoria.addEventListener('change', alCambiarCategoria);
destino.addEventListener('change', alCambiarDestino);
for (const r of form.querySelectorAll('input[name="borrado_seguro"]')) r.addEventListener('change', revisarBorrado);
alCambiarCategoria();
campoEquipo.hidden = destino.value !== 'Reutilizada en la sala';

// El escáner termina con ENTER: en los campos de texto, ENTER pasa al siguiente campo en vez de
// enviar el formulario a medias.
const enfocables = () => [...form.querySelectorAll('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file]), select, textarea, button[type=submit]')].filter((el) => !el.closest('[hidden]'));
form.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || ['submit', 'checkbox', 'radio'].includes(e.target.type)) return;
  e.preventDefault();
  if (e.target.id === 'id') revisarId();
  const lista = enfocables();
  const siguiente = lista[lista.indexOf(e.target) + 1];
  siguiente?.focus();
});

// --- Campo de etiqueta (solo en Registrar): dice qué pasa con el ID escaneado -------------
const campoId = $('id');
const estadoId = $('estado-id');
let ultimoRevisado = null;
async function revisarId() {
  if (!campoId) return;
  const texto = campoId.value.trim();
  if (texto === ultimoRevisado) return;
  ultimoRevisado = texto;
  estadoId.className = 'estado-id';
  if (!texto) {
    estadoId.textContent = '';
    return;
  }
  try {
    const res = await fetch(`/api/escaneo?texto=${encodeURIComponent(texto)}`, { headers: { Accept: 'application/json' } });
    const d = await res.json();
    if (d.id && d.id !== texto) campoId.value = d.id;
    if (d.resultado === 'sin_registrar') {
      estadoId.textContent = `✔ ${d.id}: etiqueta impresa, lista para registrar.`;
      estadoId.classList.add('estado-ok');
    } else if (d.resultado === 'no_existe') {
      estadoId.textContent = `${d.id} no estaba impreso: se reservará con este registro.`;
      estadoId.classList.add('estado-info');
    } else if (d.resultado === 'registrada') {
      estadoId.replaceChildren(`✖ ${d.pieza.id} ya está registrada (${d.pieza.categoria}). `);
      const a = document.createElement('a');
      a.href = `/p/${d.pieza.id}`;
      a.textContent = 'Ver su ficha';
      estadoId.append(a);
      estadoId.classList.add('estado-error');
    } else {
      estadoId.textContent = `✖ ${d.mensaje || 'Código no reconocido.'}`;
      estadoId.classList.add(d.error === 'QR_ANTIGUO' ? 'estado-ambar' : 'estado-error');
    }
  } catch {
    estadoId.textContent = 'No se pudo comprobar el ID (sin conexión). Se revisará al guardar.';
  }
}
campoId?.addEventListener('change', revisarId);
if (campoId?.value) revisarId();

// Si el servidor devolvió errores, el foco va al primer campo con problema (no al de la etiqueta).
const primerError = form.querySelector('[aria-invalid="true"]');
if (primerError) {
  primerError.focus();
  primerError.scrollIntoView({ block: 'center' });
}

// --- Vista previa de la foto (solo en Editar) ----------------------------------------------
const foto = $('foto');
foto?.addEventListener('change', () => {
  const archivo = foto.files[0];
  $('foto_enviada').value = archivo ? '1' : '0';
  const vista = $('vista-foto');
  if (archivo && archivo.type.startsWith('image/')) {
    vista.src = URL.createObjectURL(archivo);
    vista.hidden = false;
  }
});
