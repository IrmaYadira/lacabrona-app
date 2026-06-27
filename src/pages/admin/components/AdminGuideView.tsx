import { useState } from 'react';

const STEPS = [
  {
    num: 1,
    title: 'Entra al POS',
    icon: 'ri-login-box-line',
    image: 'https://readdy.ai/api/search-image?query=Young%20mexican%20waitress%20in%20casual%20uniform%20logging%20into%20a%20digital%20tablet%20at%20a%20modern%20bar%20counter%2C%20warm%20amber%20lighting%2C%20clean%20professional%20style%2C%20friendly%20expression%2C%20illustration%20style%20with%20soft%20gradients%20and%20simple%20background%2C%20no%20text%20on%20screen&width=800&height=500&seq=guia-pos-01&orientation=landscape',
    what: 'Abre el navegador y ve al POS del bar.',
    how: [
      'El gerente te dará el acceso.',
      'Ingresa tu nombre de mesero en la pantalla de login.',
      'Ya dentro verás todas las mesas activas del turno.',
    ],
    tip: 'Tu nombre queda registrado en cada cuenta que abras, así sabrás cuáles son tuyas.',
  },
  {
    num: 2,
    title: 'Abre una cuenta nueva',
    icon: 'ri-user-add-line',
    image: 'https://readdy.ai/api/search-image?query=Mexican%20waitress%20at%20busy%20bar%20greeting%20a%20customer%20group%20at%20a%20table%20while%20holding%20a%20tablet%2C%20warm%20atmosphere%2C%20friendly%20smile%2C%20professional%20service%2C%20illustration%20style%20with%20soft%20amber%20and%20cream%20tones%2C%20clean%20simple%20background&width=800&height=500&seq=guia-pos-02&orientation=landscape',
    what: 'Cada vez que llega un cliente, abre su cuenta.',
    how: [
      'Click en el botón naranja "Nueva Cuenta".',
      'Selecciona la mesa, barra o sillón donde se sentó.',
      'Opcional: elige la zona (Barra, Terraza, VIP...).',
      'Si conoces al cliente, busca su nombre o celular.',
      'Si es nuevo, regístralo con nombre y WhatsApp.',
    ],
    tip: 'Si el cliente ya está en el bar, el sistema te lleva directo a su cuenta existente. ¡Ya no se duplica!',
  },
  {
    num: 3,
    title: 'Busca clientes frecuentes',
    icon: 'ri-search-line',
    image: 'https://readdy.ai/api/search-image?query=Mexican%20waitress%20searching%20on%20a%20digital%20tablet%20at%20restaurant%20counter%2C%20concentrated%20but%20friendly%20look%2C%20warm%20interior%20lighting%2C%20professional%20bar%20setting%2C%20illustration%20style%20clean%20and%20modern%2C%20amber%20and%20cream%20color%20palette&width=800&height=500&seq=guia-pos-03&orientation=landscape',
    what: 'El directorio guarda el historial de cada cliente.',
    how: [
      'Usa la barra de búsqueda para encontrar clientes por nombre o celular.',
      'El sistema te muestra sus visitas anteriores y total gastado.',
      'Si ya tiene cuenta abierta, aparece un botón verde "En el bar".',
      'Click en "Ir a cuenta" para seguir tomando su pedido.',
    ],
    tip: 'Clientes frecuentes se ponen contentos cuando los reconoces por nombre. El historial te ayuda a dar mejor servicio.',
  },
  {
    num: 4,
    title: 'Agrega productos a la cuenta',
    icon: 'ri-shopping-basket-line',
    image: 'https://readdy.ai/api/search-image?query=Mexican%20waitress%20taking%20food%20and%20drink%20order%20on%20a%20tablet%20at%20a%20lively%20bar%2C%20customers%20in%20background%20blurred%2C%20warm%20lighting%2C%20friendly%20professional%20vibe%2C%20illustration%20style%20soft%20gradients%20amber%20and%20cream%20tones&width=800&height=500&seq=guia-pos-04&orientation=landscape',
    what: 'Cada producto se agrega en una nueva ronda, igual que en una comanda de papel.',
    how: [
      'Dentro de la cuenta, usa el menú de la izquierda para buscar productos.',
      'Selecciona cantidad, extras y notas si aplica.',
      'Click en "Al Carrito" y luego en "Agregar a Cuenta".',
      'El sistema envía la comanda por WhatsApp a cocina/barra.',
      'El subtotal se actualiza automáticamente.',
    ],
    tip: 'Puedes agregar notas como "sin cebolla" o "bien cocida". La cocina las lee en la comanda.',
  },
  {
    num: 5,
    title: 'Agrega a una ronda existente (+)',
    icon: 'ri-add-circle-fill',
    image: 'https://readdy.ai/api/search-image?query=Closeup%20of%20Mexican%20waitress%20hands%20tapping%20a%20plus%20button%20on%20a%20tablet%20screen%20showing%20a%20food%20order%20list%2C%20warm%20bar%20background%20blurred%2C%20amber%20lighting%2C%20clean%20illustration%20style%20with%20soft%20gradients&width=800&height=500&seq=guia-pos-05&orientation=landscape',
    what: 'Si el cliente pide algo extra en la misma ronda, usa el botón +.',
    how: [
      'En la lista de rondas, busca la ronda donde quieres agregar.',
      'Click en el botón verde "+" a la derecha del precio.',
      'Se abre el menú con un banner "Agregando a Ronda #X".',
      'Elige el producto, cantidad y notas. Confirma.',
      'El producto se suma a esa misma ronda sin crear una nueva.',
    ],
    tip: 'Ideal cuando el cliente dice "ah, y también tráeme otras alitas". Todo queda junto en la misma ronda.',
  },
  {
    num: 6,
    title: 'Elimina una ronda (basurero)',
    icon: 'ri-delete-bin-line',
    image: 'https://readdy.ai/api/search-image?query=Mexican%20waitress%20reviewing%20order%20on%20tablet%20at%20bar%20counter%2C%20one%20finger%20near%20delete%20icon%2C%20thoughtful%20expression%2C%20warm%20lighting%2C%20clean%20modern%20illustration%20style%2C%20amber%20and%20cream%20palette&width=800&height=500&seq=guia-pos-06&orientation=landscape',
    what: 'Si el cliente se arrepiente o te equivocaste, borra la ronda completa.',
    how: [
      'Click en el ícono del basurero rojo junto a la ronda.',
      'Primer click: el botón cambia a "No" / "Sí, eliminar".',
      'Esto evita borrones accidentales.',
      'Click en "Sí, eliminar" para confirmar.',
      'La ronda y todos sus productos desaparecen de la cuenta.',
    ],
    tip: 'El sistema registra quién eliminó la ronda y cuándo. Todo queda en el historial por transparencia.',
  },
  {
    num: 7,
    title: 'Cierra la cuenta y cobra',
    icon: 'ri-money-dollar-circle-fill',
    image: 'https://readdy.ai/api/search-image?query=Mexican%20waitress%20handing%20a%20check%20to%20happy%20customer%20at%20bar%20table%2C%20both%20smiling%2C%20warm%20atmosphere%2C%20tablet%20visible%20on%20table%2C%20professional%20service%20moment%2C%20illustration%20style%20soft%20amber%20and%20cream%20tones&width=800&height=500&seq=guia-pos-07&orientation=landscape',
    what: 'Cuando el cliente termina, cierras la cuenta y cobras.',
    how: [
      'Click en el botón verde "Cerrar Cuenta" abajo.',
      'Selecciona el método de pago: efectivo, tarjeta o transferencia.',
      'Ingresa el monto recibido. El sistema calcula el cambio.',
      'Confirma con tu contraseña de mesero.',
      'La cuenta se marca como cerrada y desaparece del panel.',
      'El cliente acumula puntos de lealtad automáticamente.',
    ],
    tip: 'Si el cliente pide la cuenta desde el menú web, te llega una notificación de "Quieren pagar" con botón verde.',
  },
];

export default function AdminGuideView() {
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggleStep = (num: number) => {
    setExpanded(prev => prev === num ? null : num);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
          <i className="ri-book-open-line" />
          Guía rápida para meseros
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-3">
          Mariana te enseña el POS
        </h2>
        <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
          Sigue a Mariana paso a paso y domina el sistema en 5 minutos. 
          Desde abrir una cuenta hasta cobrar, aquí está todo lo que necesitas.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-5">
        {STEPS.map((step) => {
          const isOpen = expanded === step.num;
          return (
            <div
              key={step.num}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-300 hover:border-amber-200"
            >
              {/* Step header — clickeable */}
              <button
                onClick={() => toggleStep(step.num)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer group"
              >
                {/* Step number */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                  isOpen ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600 group-hover:bg-amber-200'
                }`}>
                  <span className="font-black text-sm">{step.num}</span>
                </div>

                {/* Title + icon */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <i className={`${step.icon} ${isOpen ? 'text-amber-500' : 'text-gray-400'} text-lg`} />
                    <h3 className={`font-bold text-base ${isOpen ? 'text-amber-600' : 'text-gray-800'}`}>
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5 line-clamp-1">{step.what}</p>
                </div>

                {/* Expand icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  isOpen ? 'bg-amber-100 text-amber-600 rotate-180' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                }`}>
                  <i className="ri-arrow-down-s-line" />
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="px-5 pb-5 pt-0 animate-[fadeIn_0.3s_ease-out]">
                  {/* Image */}
                  <div className="rounded-xl overflow-hidden mb-4 bg-gray-50">
                    <img
                      src={step.image}
                      alt={`Mariana — ${step.title}`}
                      title={`Paso ${step.num}: ${step.title}`}
                      className="w-full h-52 md:h-64 object-cover object-top"
                      loading="lazy"
                    />
                  </div>

                  {/* What section */}
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      <i className="ri-information-line mr-1 text-amber-400" />
                      ¿Qué hago?
                    </p>
                    <p className="text-gray-700 text-sm leading-relaxed">{step.what}</p>
                  </div>

                  {/* How section */}
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      <i className="ri-list-check mr-1 text-amber-400" />
                      ¿Cómo se hace?
                    </p>
                    <ol className="space-y-1.5">
                      {step.how.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          {item}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Tip */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                    <i className="ri-lightbulb-flash-line text-amber-500 text-lg flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 leading-relaxed">
                      <span className="font-bold">Tip de Mariana: </span>
                      {step.tip}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      <div className="mt-10 text-center bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl p-8 border border-amber-100">
        <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center mx-auto mb-4">
          <i className="ri-emotion-happy-line text-white text-2xl" />
        </div>
        <h3 className="text-xl font-black text-gray-900 mb-2">¿Listo para tu primer turno?</h3>
        <p className="text-gray-500 text-sm max-w-md mx-auto mb-4">
          Ve al POS y practica. Si algo sale mal, no te preocupes — todo se puede corregir. 
          Mariana y el gerente están para ayudarte.
        </p>
        <a
          href="/pos"
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
        >
          <i className="ri-store-3-line" />
          Ir al POS
        </a>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}