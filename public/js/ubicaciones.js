// /ubicaciones?resaltar=…: lleva la vista al lugar resaltado (útil en celular, donde queda abajo).
const lugar = document.getElementById('lugar-resaltado');
if (lugar) {
  const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  lugar.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'center' });
}
