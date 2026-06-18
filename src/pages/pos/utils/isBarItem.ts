/**
 * Determina si un producto pertenece a la estación de BARRA
 * (bebidas, cervezas, micheladas, preparados, shots, refrescos, cigarros, etc.)
 * Todo lo demás va a COCINA (alitas, boneless, hamburguesas, hot dogs, sides, etc.)
 */
export function isBarItem(productName: string): boolean {
  const name = productName.toLowerCase();

  // ── Cervezas ──
  const beerKeywords = [
    'corona', 'victoria', 'modelo', 'pacífico', 'pacifico', 'michelob',
    'barril', 'lager', 'indio', 'ampolleta', 'caguama', 'mega ', 'medio ',
    '0.0 alcohol', 'sin alcohol',
  ];
  if (beerKeywords.some(k => name.includes(k))) return true;

  // ── Micheladas ──
  if (name.includes('michelada')) return true;

  // ── Vasos preparados ──
  const vasoKeywords = [
    'vaso chelado', 'vaso michelado', 'clamatado', 'rusa de ', 'rusa de',
    'sal y limones', 'orden de sal',
  ];
  if (vasoKeywords.some(k => name.includes(k))) return true;

  // ── Preparados (bebidas con alcohol) ──
  const preparadoKeywords = [
    'bacacho', 'tequilita', 'cuervo loco', 'cuervo plata', 'cabrito preparado',
    'azulón', 'torero', 'smirnoff ice', 'black & white power', 'tepa cool',
    'sky blue', 'leguas preparado', 'don ramón', 'don ramon', 'charro güero',
    'charro guero', 'charro negro', 'azulito', 'red label', 'preparado',
  ];
  if (preparadoKeywords.some(k => name.includes(k))) return true;

  // ── Shots / Destilados ──
  const shotKeywords = [
    '30ml', 'sky ', 'centenario', 'cabrito', 'azul centenario', '7 leguas',
    'jose cuervo', 'black & white', 'smirnoff', 'torres 10', 'red label',
    'don ramón', 'don ramon', 'hacienda de tepa', 'bacardi', 'bacacho',
  ];
  if (shotKeywords.some(k => name.includes(k))) return true;

  // ── Refrescos / Bebidas sin alcohol ──
  const sodaKeywords = [
    'refresco', 'fanta', 'sprite', 'mirinda', 'manzanita', 'seven up', 'squirt',
    'coca-cola', 'coca cola', 'ginger ale', 'sidral', 'té arizona', 'te arizona',
    'jugo del valle', 'agua mineral', 'bolis de tejuino', 'suero electrolit',
    'red bull', 'electrolit', 'arizona', 'tejuino',
  ];
  if (sodaKeywords.some(k => name.includes(k))) return true;

  // ── Latas premezcladas ──
  const cannedKeywords = [
    'caribe cooler', 'new mix', 'bacardi coca-cola', 'bacardi coca cola',
  ];
  if (cannedKeywords.some(k => name.includes(k))) return true;

  // ── Cigarros ──
  const cigaretteKeywords = [
    'marlboro', 'benson', 'pall mall', 'cigarro', 'cajetilla', 'suelto',
  ];
  if (cigaretteKeywords.some(k => name.includes(k))) return true;

  return false;
}