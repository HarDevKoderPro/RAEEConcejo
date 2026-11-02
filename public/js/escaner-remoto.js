// Escáner con el celular: el usuario lee un QR con la cámara de su celular (con su sesión
// abierta) y el código llega a esta página como si lo hubiera escrito un lector (Barcode to PC).
// Se carga en /consulta, /movimiento y /demo solo cuando hay sesión.

const campo = document.getElementById('escaneo');
const indicador = document.getElementById('escaner-remoto');

function pintar(estado) {
  if (!indicador) return;
  indicador.dataset.estado = estado;
  indicador.hidden = false;
}

if (campo && 'EventSource' in window) {
  const fuente = new EventSource('/eventos?mios=1');
  fuente.addEventListener('open', () => pintar('conectado'));
  fuente.addEventListener('error', () => pintar('reconectando'));
  fuente.addEventListener('escaneo', (e) => {
    let id;
    try {
      ({ id } = JSON.parse(e.data));
    } catch {
      return;
    }
    if (!/^RAEE-\d{4}$/.test(id ?? '')) return;
    // Igual que un lector: escribe el código y presiona ENTER.
    campo.value = id;
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    indicador?.classList.remove('escaner-recibido');
    void indicador?.offsetWidth;
    indicador?.classList.add('escaner-recibido');
  });
}
