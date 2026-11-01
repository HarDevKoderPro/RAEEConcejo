// /buscar: al cambiar un filtro se aplica sin pulsar "Buscar". Sin JavaScript el botón basta.
const form = document.getElementById('form-buscar');
for (const select of form.querySelectorAll('select')) {
  select.addEventListener('change', () => {
    // Los campos vacíos no se envían, para que la URL quede corta y fácil de compartir.
    for (const campo of form.elements) {
      if (campo.name && !campo.value) campo.disabled = true;
    }
    form.submit();
  });
}
form.addEventListener('submit', () => {
  for (const campo of form.elements) {
    if (campo.name && !campo.value) campo.disabled = true;
  }
});
// Al volver con el botón "atrás", reactivar los campos.
window.addEventListener('pageshow', () => {
  for (const campo of form.elements) campo.disabled = false;
});
