import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraerId } from '../src/lib/escaneo.js';

const ok = (entrada, id) => assert.deepEqual(extraerId(entrada), { id }, `entrada: ${JSON.stringify(entrada)}`);
const falla = (entrada, error) => assert.deepEqual(extraerId(entrada), { error }, `entrada: ${JSON.stringify(entrada)}`);

test('ID exacto', () => {
  ok('RAEE-0001', 'RAEE-0001');
  ok('RAEE-0048', 'RAEE-0048');
  ok('RAEE-9999', 'RAEE-9999');
});

test('enlace completo de la ficha', () => {
  ok('https://raee.dominio.com/p/RAEE-0001', 'RAEE-0001');
  ok('http://localhost:3100/p/RAEE-0010', 'RAEE-0010');
  ok('https://raee.dominio.com/p/RAEE-0001?origen=qr', 'RAEE-0001');
  ok('https://raee.dominio.com/p/raee-7/', 'RAEE-0007');
});

test('un dominio con "raee" y números no se confunde con el ID', () => {
  ok('https://raee-2.ejemplo.com/p/RAEE-0015', 'RAEE-0015');
});

test('normaliza mayúsculas, espacios, guion y ceros', () => {
  ok(' raee-1 ', 'RAEE-0001');
  ok('raee 0001', 'RAEE-0001');
  ok('RAEE0001', 'RAEE-0001');
  ok('raee_12', 'RAEE-0012');
  ok('Raee-00036', 'RAEE-0036');
  ok('\tRAEE-0010\r\n', 'RAEE-0010'); // ENTER final del escáner
});

test('QR antiguo con rótulos de datos', () => {
  // Ejemplo de prueba: falta el texto real de un QR antiguo (pendiente de la persona, §15).
  falla('Tipo: Tarjeta madre', 'QR_ANTIGUO');
  falla('ID: RAEE-0001 | Tipo: Tarjeta madre | Marca: Foxconn', 'QR_ANTIGUO');
  falla('Marca: Kingston; Modelo: KVR13N9S8/4', 'QR_ANTIGUO');
  falla('Serial: UYRL81507803', 'QR_ANTIGUO');
  falla('Ubicación: Caja 1 Sala 1', 'QR_ANTIGUO');
});

test('QR antiguo de varias líneas, aunque traiga el ID (se evalúa antes de la regex)', () => {
  falla('RAEE-0001\nTarjeta madre\nFoxconn 45GMX', 'QR_ANTIGUO');
  falla('RAEE-0001\r\nTipo: Tarjeta madre', 'QR_ANTIGUO');
});

test('vacío o solo espacios', () => {
  falla('', 'VACIO');
  falla('   ', 'VACIO');
  falla(undefined, 'VACIO');
  falla(null, 'VACIO');
});

test('textos que no son etiquetas del inventario', () => {
  falla('hola', 'NO_RECONOCIDO');
  falla('7501031311309', 'NO_RECONOCIDO'); // código de barras de fabricante
  falla('RAEE-', 'NO_RECONOCIDO');
  falla('RAEE-0000', 'NO_RECONOCIDO');
  falla('RAEE-12345', 'NO_RECONOCIDO');
  falla('https://otro-sitio.com/', 'NO_RECONOCIDO');
});
