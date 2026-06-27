/**
 * Utilidad compartida para anunciar pedidos por voz (Text-to-Speech).
 * Usa la Web Speech API con voz en español mexicano.
 */

function speakRaw(text: string): void {
  if (!('speechSynthesis' in window)) return;
  
  // Cancelar cualquier anuncio previo para que no se encimen
  window.speechSynthesis.cancel();
  
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'es-MX';
  utter.rate = 1.08;   // ligeramente rápido para ser ágil
  utter.pitch = 1.05;  // un poquito más agudo para destacar
  utter.volume = 1.0;
  
  // Buscar voz nativa en español
  const voices = window.speechSynthesis.getVoices();
  const esVoice = voices.find(v => v.lang.startsWith('es-MX')) 
    || voices.find(v => v.lang.startsWith('es'));
  if (esVoice) utter.voice = esVoice;
  
  window.speechSynthesis.speak(utter);
}

export interface OrderItemVoice {
  name: string;
  qty: number;
}

/**
 * Anuncia un nuevo pedido entrante por voz.
 * Ejemplo: "Nuevo pedido de Mesa 3 — 2 Alitas clásicas, 1 Michelada Mega."
 */
export function speakNewOrder(spot: string, items: OrderItemVoice[], total?: number, hasExtras?: boolean): void {
  if (items.length === 0) return;
  
  const itemsList = items
    .map(i => `${i.qty > 1 ? i.qty + ' ' : ''}${i.name}`)
    .join(', ');
  
  let message = `Nuevo pedido de ${spot}. ${itemsList}.`;
  
  if (hasExtras) {
    message += ' ¡Atención! Tiene extras de pago.';
  }
  
  if (total !== undefined && total > 0) {
    const totalStr = total % 1 === 0 ? total.toFixed(0) : total.toFixed(2);
    message += ` Total: ${totalStr} pesos.`;
  }
  
  speakRaw(message);
}

/**
 * Anuncia un pedido urgente con extras de pago
 */
export function speakExtraAlert(spot: string, items: OrderItemVoice[]): void {
  if (items.length === 0) return;
  
  const itemsList = items
    .map(i => `${i.qty > 1 ? i.qty + ' ' : ''}${i.name}`)
    .join(', ');
  
  const message = `Pedido con extras de ${spot}. Revisa las notas. ${itemsList}.`;
  speakRaw(message);
}

/**
 * Cancela cualquier anuncio de voz en curso
 */
export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}