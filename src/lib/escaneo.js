// Interpreta lo que escribe el lector (Barcode to PC, cámara o teclado) — CLAUDE.md §6.2.
//
// Devuelve { id: 'RAEE-0001' } o { error: 'VACIO' | 'QR_ANTIGUO' | 'NO_RECONOCIDO' }.
//
// Orden obligatorio: primero se detecta el QR antiguo y DESPUÉS se aplica la regex.
// Si fuera al revés, un QR antiguo que incluya el ID en su texto pasaría como válido.

// Rótulos que traían los QR antiguos con datos ("Tipo: Tarjeta madre", "Serial: …").
const ROTULOS_ANTIGUOS =
  /(^|[\s;,|])(tipo|marca|modelo|p\/?n|serial|s\/?n|estado|destino|ubicaci[oó]n|descripci[oó]n|fecha|categor[ií]a)\s*:/i;

// Regex base de §6.2, con dos protecciones: no acepta más de 4 cifras (RAEE-12345)
// ni que el número siga pegado a otra cifra.
const PATRON_ID = /RAEE[\s\-_]?0*(\d{1,4})(?!\d)/i;

export const MENSAJES_ESCANEO = {
  VACIO: 'No llegó ningún código. Escanea de nuevo.',
  QR_ANTIGUO: 'Es un QR antiguo con texto: reimprímelo con su ID.',
  NO_RECONOCIDO: 'Este código no es una etiqueta del inventario (se espera algo como RAEE-0001).',
};

export function esQrAntiguo(texto) {
  const limpio = String(texto ?? '').trim();
  return /[\r\n]/.test(limpio) || ROTULOS_ANTIGUOS.test(limpio);
}

export function formatearId(numero) {
  return `RAEE-${String(numero).padStart(4, '0')}`;
}

export function extraerId(texto) {
  const limpio = String(texto ?? '').trim();
  if (!limpio) return { error: 'VACIO' };
  if (esQrAntiguo(limpio)) return { error: 'QR_ANTIGUO' };

  // En un enlace se busca después de "/p/", para que un dominio como "raee-2.ejemplo.com"
  // no se confunda con un ID.
  const enlace = limpio.match(/\/p\/([^/?#]+)/i);
  const m = (enlace ? decodeURIComponentSeguro(enlace[1]) : limpio).match(PATRON_ID);
  if (!m) return { error: 'NO_RECONOCIDO' };

  const numero = Number(m[1]);
  if (numero < 1) return { error: 'NO_RECONOCIDO' }; // RAEE-0000 no existe
  return { id: formatearId(numero) };
}

function decodeURIComponentSeguro(texto) {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}
