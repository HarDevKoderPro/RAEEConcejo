// QR en SVG generado en el servidor (CLAUDE.md §8): nítido al imprimir y sin CDN.
// El QR lleva el enlace a la ficha, no los datos de la pieza (§6.1).
import QRCode from 'qrcode';

export const urlFicha = (baseUrl, id) => `${baseUrl}/p/${id}`;

export async function svgQr(texto) {
  const svg = await QRCode.toString(texto, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#000000', light: '#ffffff' } });
  // Sin ancho ni alto fijos: el tamaño lo da la hoja de estilos de la etiqueta (en mm).
  return svg.replace('<svg ', '<svg class="qr" aria-hidden="true" focusable="false" ');
}
