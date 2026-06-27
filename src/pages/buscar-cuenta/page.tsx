import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabasePos } from '@/pages/pos/supabasePos';
import { getAccountHistory } from '@/hooks/useAccountHistory';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285';

interface FoundAccount {
  id: number;
  spot: string;
  area: string;
  status: 'open' | 'closed';
  customer_name?: string;
  total: number;
  itemCount: number;
}

export function isAccountInHistory(accountId: number): boolean {
  const history = getAccountHistory();
  return history.some(e => e.id === accountId);
}

const faqs = [
  {
    q: "¿Cómo buscar mi cuenta en La Cabrona?",
    a: "Puedes buscar tu cuenta de consumo ingresando tu nombre exactamente como lo registraste al hacer tu pedido, o escribiendo el número de mesa donde estás sentado. El sistema busca en tiempo real entre las cuentas activas del sistema POS del bar.",
  },
  {
    q: "¿Por qué no aparece mi cuenta cuando busco?",
    a: "Si tu cuenta no aparece, verifica que el nombre coincida exactamente con el que usaste al pedir. También puedes intentar con el número de mesa. Si aún no la encuentras, es posible que tu cuenta ya haya sido cerrada por el mesero o que aún no haya sido registrada en el sistema.",
  },
  {
    q: "¿Cuánto tiempo se guarda mi cuenta en el historial?",
    a: "Las cuentas se guardan automáticamente en el historial de tu celular mientras no borres los datos del navegador. El sistema guarda un máximo de 10 cuentas por dispositivo. Las cuentas abiertas se actualizan en tiempo real para que siempre veas el total actual.",
  },
  {
    q: "¿Puedo ver mi cuenta desde cualquier celular?",
    a: "No, el historial de cuentas se guarda localmente en el navegador de cada celular. Si cambias de dispositivo, deberás buscar tu cuenta nuevamente por nombre o número de mesa. El historial no está vinculado a una cuenta de usuario.",
  },
  {
    q: "¿La información de mi cuenta es privada?",
    a: "El sistema solo muestra cuentas que están actualmente abiertas en el bar. Una vez que tu cuenta se cierra, ya no aparece en el buscador. Solo puedes acceder a una cuenta cerrada si ya la tenías guardada en el historial de tu dispositivo. Esto protege tu información de consumo de terceros.",
  },
];

export default function BuscarCuentaPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<FoundAccount[]>([]);
  const [showFaq, setShowFaq] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setSearched(false);

    try {
      const mesaNum = q.replace(/^Mesa\s*/i, '').trim();
      const mesaLabel = `Mesa ${mesaNum}`;

      const spotFilters = [q, mesaLabel, mesaNum]
        .filter(Boolean)
        .map(v => `spot.ilike.%${v}%`);
      const nameFilter = `customer_name.ilike.%${q}%`;
      const phoneFilter = `customer_phone.ilike.%${q}%`;
      const orFilter = [...spotFilters, nameFilter, phoneFilter].join(',');

      // Solo buscar cuentas abiertas y recientes (últimas 24 horas)
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data } = await supabasePos
        .from('pos_accounts')
        .select('id, spot, area, status, customer_name, pos_account_items(unit_price, quantity)')
        .eq('status', 'open')
        .gte('created_at', last24h)
        .or(orFilter)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        const found: FoundAccount[] = (data as {
          id: number;
          spot: string;
          area: string;
          status: 'open' | 'closed';
          customer_name?: string;
          pos_account_items: { unit_price: number; quantity: number }[];
        }[]).map(acc => ({
          id: acc.id,
          spot: acc.spot,
          area: acc.area,
          status: acc.status,
          customer_name: acc.customer_name,
          total: (acc.pos_account_items ?? []).reduce(
            (s, i) => s + i.unit_price * i.quantity, 0
          ),
          itemCount: (acc.pos_account_items ?? []).length,
        }));

        setResults(found);
      } else {
        setResults([]);
      }
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, [query]);

  const openAccount = useCallback((acc: FoundAccount) => {
    navigate(`/cuenta?id=${acc.id}`);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-950 pb-16">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-5 pt-10 pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white cursor-pointer transition-colors flex-shrink-0"
          >
            <i className="ri-arrow-left-s-line text-xl" />
          </button>
          <img
            src={LOGO_URL}
            alt="La Cabrona"
            title="La Cabrona Alitas & Beer"
            className="w-10 h-10 rounded-full object-cover border-2 border-amber-500 flex-shrink-0"
            loading="lazy"
          />
          <div className="flex-1 min-w-0">
            <h1
              className="text-white font-bold text-base leading-tight"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.08em' }}
            >
              BUSCAR MI CUENTA
            </h1>
            <p className="text-amber-500 text-xs font-bold tracking-widest">La Cabrona · Alitas &amp; Beer</p>
          </div>
        </div>

        {/* Buscador */}
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tu nombre, teléfono o número de mesa..."
              className="w-full bg-gray-800 border border-gray-700 focus:border-amber-500 text-white placeholder-gray-500 text-base rounded-2xl pl-11 pr-4 py-4 outline-none transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setSearched(false); setResults([]); inputRef.current?.focus(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
              >
                <i className="ri-close-circle-fill text-lg" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="px-5 py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-2xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
          >
            {loading
              ? <i className="ri-loader-4-line animate-spin text-xl" />
              : <span>Buscar</span>
            }
          </button>
        </form>
      </div>

      {/* Sugerencias rápidas antes de buscar */}
      {!searched && !loading && (
        <div className="px-5 pt-8">
          {/* Descripción SEO expandida */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 mb-6">
            <p className="text-gray-400 text-sm leading-relaxed mb-3">
              Busca tu cuenta activa en <strong className="text-white">La Cabrona Alitas &amp; Beer</strong> usando tu nombre o número de mesa. El sistema busca en tiempo real entre las cuentas abiertas del bar.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed mb-3">
              ¿Cómo funciona? Cuando el mesero abre una cuenta a tu nombre, aparece en el sistema. Solo escribe tu nombre o el número de tu mesa en el buscador de arriba. El sistema encuentra tu cuenta en segundos. Puedes ver el total acumulado, los productos que ordenaste y cuántos están pendientes. La información se actualiza en tiempo real. Si tienes cuentas previas en este celular, aparecen en la sección de historial.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Este sistema es ideal para cuando estás en el bar con amigos y quieres monitorear cuánto llevas gastado sin tener que preguntar al mesero. También funciona si dejaste una cuenta abierta en una visita anterior y quieres ver si aún está activa o si ya fue cerrada por el personal.
            </p>
          </div>

          {/* Sección: El Sistema de Cuentas en La Cabrona */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 mb-6">
            <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
              <i className="ri-receipt-line text-amber-400" />
              El Sistema de Cuentas en La Cabrona
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-3">
              En <strong className="text-white">La Cabrona Alitas &amp; Beer</strong> utilizamos un sistema digital de gestión de cuentas que permite a cada cliente seguir su consumo en tiempo real desde su propio celular. Desde el momento en que el mesero abre una cuenta a tu nombre, todos los productos que ordenes se registran automáticamente en el sistema POS del bar.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed mb-3">
              El sistema es completamente transparente: puedes ver el precio de cada artículo, la cantidad ordenada y el subtotal parcial en cualquier momento. Esto elimina las sorpresas al momento de pagar y te permite controlar tu presupuesto mientras disfrutas de la experiencia. Cada vez que el mesero añade una cerveza, una orden de alitas o cualquier otro producto a tu cuenta, el total se actualiza instantáneamente.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Las cuentas abiertas se distinguen visualmente con una barra de estado verde y un indicador parpadeante, mientras que las cuentas cerradas aparecen en gris para indicar que ya fueron liquidadas. Este sistema de colores te permite identificar de un vistazo si tu cuenta sigue activa o si ya fue cerrada por el mesero al momento de pagar.
            </p>
          </div>

          {/* Sección: Ventajas de Buscar tu Cuenta */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 mb-6">
            <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
              <i className="ri-search-2-line text-amber-400" />
              Ventajas de Buscar tu Cuenta
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-3">
              Buscar tu cuenta directamente desde tu celular ofrece múltiples ventajas que mejoran significativamente tu experiencia en el bar. La primera y más importante es la <strong className="text-white">transparencia total</strong> en tu consumo: puedes ver exactamente qué productos has ordenado, cuánto cuesta cada uno y cuánto llevas gastado en total, sin depender de la memoria del mesero o de la cuenta impresa.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed mb-3">
              Otra ventaja clave es la <strong className="text-white">actualización en tiempo real</strong>. Cuando estás en una mesa con varios amigos y cada uno pide diferentes productos, el total puede cambiar rápidamente. Con el buscador de cuentas, siempre tienes el número exacto al alcance de tu mano. Esto es especialmente útil cuando se acerca la hora de pagar y necesitas saber cuánto dinero preparar.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Además, el sistema permite verificar si tu cuenta aún está abierta. A veces, después de pagar, puede haber confusiones sobre si la cuenta ya fue cerrada correctamente. Buscar tu cuenta te da certeza inmediata sobre el estado de tu pedido. Si aparece como cerrada, puedes estar tranquilo de que todo quedó correctamente registrado en el sistema.
            </p>
          </div>

          {/* Sección: Experiencia del Cliente en el Bar */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 mb-6">
            <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
              <i className="ri-restaurant-2-line text-amber-400" />
              Experiencia del Cliente en La Cabrona
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-3">
              <strong className="text-white">La Cabrona Alitas &amp; Beer</strong> se ha convertido en uno de los destinos favoritos de Zapopan y El Mante para quienes buscan una experiencia gastronómica única combinada con un ambiente relajado y divertido. Nuestro bar ofrece desde clásicas alitas de pollo en múltiples sabores hasta una extensa selección de cervezas artesanales y de barril, todo en un entorno pensado para que disfrutes con amigos, familia o compañeros de trabajo.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed mb-3">
              El sistema de cuentas digitales es parte de nuestra filosofía de poner al cliente en control. Queremos que tu visita sea lo más fluida posible, desde que llegas hasta que te vas. Al poder buscar tu cuenta desde tu celular, eliminas la necesidad de llamar al mesero solo para preguntar cuánto llevas gastado. Esto libera al mesero para atender a más clientes y te da a ti la libertad de revisar tu consumo cuando quieras.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Ya sea que estés celebrando un cumpleaños, viendo un partido de fútbol en nuestras pantallas, jugando una partida de billar o simplemente pasando una tarde relajada, el sistema de cuentas te acompaña durante toda tu visita. Es una extensión digital de la experiencia presencial que te ofrecemos en <strong className="text-white">La Cabrona</strong>.
            </p>
          </div>

          {/* Sección: Consejos para Buscar tu Cuenta */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 mb-6">
            <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
              <i className="ri-lightbulb-line text-amber-400" />
              Consejos para Buscar tu Cuenta
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-3">
              Para obtener los mejores resultados al buscar tu cuenta, te recomendamos seguir algunos consejos prácticos. Primero, asegúrate de escribir tu nombre exactamente como lo proporcionaste al mesero. Si usaste un apodo o un nombre corto, prueba con esa versión. El sistema busca coincidencias parciales, por lo que no necesitas escribir tu nombre completo si pusiste solo tu primer nombre.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed mb-3">
              Si prefieres buscar por número de mesa, recuerda que el sistema acepta múltiples formatos: puedes escribir solo el número ("5"), agregar la palabra mesa ("Mesa 5") o incluso usar letras si la mesa tiene identificación alfabética. El buscador es flexible y encuentra tu cuenta independientemente de cómo formules la búsqueda.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Si tu cuenta no aparece en los resultados, no te preocupes. Primero, verifica que hayas escrito correctamente el nombre o mesa. Si sigue sin aparecer, es posible que la cuenta aún no haya sido registrada en el sistema (a veces el mesero tarda unos minutos en abrirla) o que ya haya sido cerrada. En ese caso, te recomendamos hablar directamente con el mesero para confirmar el estado de tu cuenta.
            </p>
          </div>

          <p className="text-gray-500 text-xs uppercase tracking-widest font-bold mb-4">
            ¿Cómo encontrar tu cuenta?
          </p>
          <div className="space-y-3">
            {[
              {
                icon: 'ri-user-search-line',
                color: 'text-amber-400',
                bg: 'bg-amber-500/10',
                title: 'Busca por tu nombre',
                desc: 'La forma más rápida. Escribe tu nombre exactamente como lo pusiste al pedir, por ejemplo "Juan Pérez" o "María". El sistema busca solo entre las cuentas abiertas del bar.',
              },
              {
                icon: 'ri-smartphone-line',
                color: 'text-purple-400',
                bg: 'bg-purple-500/10',
                title: 'Busca por tu teléfono',
                desc: 'Escribe tu número de celular y encuentra tu cuenta actual. Solo aparecerán cuentas que estén activas en este momento.',
              },
              {
                icon: 'ri-map-pin-2-line',
                color: 'text-teal-400',
                bg: 'bg-teal-500/10',
                title: 'Busca por número de mesa',
                desc: 'Si pediste en una mesa, escribe el número arriba, por ejemplo "5" o "Mesa 5". Funciona para cualquier área del bar: mesas, barras o terraza.',
              },
              {
                icon: 'ri-history-line',
                color: 'text-green-400',
                bg: 'bg-green-500/10',
                title: 'Cuentas guardadas',
                desc: 'Si ya pediste antes en este dispositivo, tus cuentas aparecen en el historial. Solo se guardan en este celular, máximo 10 cuentas.',
              },
            ].map(tip => (
              <div key={tip.title} className={`flex items-start gap-4 p-4 ${tip.bg} rounded-2xl`}>
                <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${tip.color}`}>
                  <i className={`${tip.icon} text-2xl`} />
                </div>
                <div>
                  <p className="text-white text-sm font-bold">{tip.title}</p>
                  <p className="text-gray-400 text-sm mt-0.5 leading-relaxed">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/mis-cuentas')}
              className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm font-semibold cursor-pointer transition-colors"
            >
              <i className="ri-history-line" />
              Ver mis cuentas guardadas
            </button>
          </div>
        </div>
      )}

      {/* Resultados */}
      {searched && !loading && (
        <div className="px-4 pt-5">
          {results.length === 0 ? (
            <div className="flex flex-col items-center text-center py-16 px-4 gap-5">
              <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center">
                <i className="ri-map-pin-line text-4xl text-gray-600" />
              </div>
              <div>
                <p className="text-white text-lg font-bold mb-2">No encontramos ninguna cuenta</p>
                <p className="text-gray-500 text-sm leading-relaxed">
                  No encontramos una cuenta activa para{' '}
                  <span className="text-amber-400 font-semibold">"{query}"</span>.
                  Verifica que el nombre coincida exactamente con el que usaste al pedir, o intenta con el número de mesa.
                  Si aún no la encuentras, pídele al mesero que verifique si tu cuenta ya está registrada.
                </p>
              </div>
              <button
                onClick={() => { setQuery(''); setSearched(false); setResults([]); inputRef.current?.focus(); }}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-5 py-3 rounded-2xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-search-line" />
                Buscar otra mesa
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-3 px-1">
                {results.length} resultado{results.length !== 1 ? 's' : ''} para &ldquo;{query}&rdquo;
              </p>
              {results.map(acc => {
                const isOpen = acc.status === 'open';
                return (
                  <button
                    key={acc.id}
                    onClick={() => openAccount(acc)}
                    className="w-full text-left bg-gray-900 border border-gray-800 hover:border-amber-500/50 rounded-2xl overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <div className={`h-1 w-full ${isOpen ? 'bg-green-500' : 'bg-gray-700'}`} />
                    <div className="px-4 py-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOpen ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                          <span className={`text-xs font-bold uppercase tracking-wide ${isOpen ? 'text-green-400' : 'text-gray-500'}`}>
                            {isOpen ? 'Abierta' : 'Cerrada'}
                          </span>
                        </div>
                        <p className="text-white text-2xl font-black leading-tight">{acc.spot}</p>
                        {acc.area && acc.area !== acc.spot && (
                          <p className="text-gray-500 text-xs mt-0.5">{acc.area}</p>
                        )}
                        {acc.customer_name && (
                          <p className="text-amber-400 text-sm mt-1 flex items-center gap-1">
                            <i className="ri-user-line text-xs" />
                            {acc.customer_name}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-2xl font-black ${isOpen ? 'text-amber-400' : 'text-gray-500'}`}>
                          ${acc.total.toFixed(2)}
                        </p>
                        <p className="text-gray-600 text-xs mt-0.5">{acc.itemCount} producto{acc.itemCount !== 1 ? 's' : ''}</p>
                        <div className="flex items-center justify-end gap-1 mt-2 text-amber-500 text-xs font-semibold">
                          {isOpen ? 'Ver cuenta' : 'Ver resumen'}
                          <i className="ri-arrow-right-s-line" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FAQs */}
      <div className="px-5 pt-8 pb-6">
        <button
          onClick={() => setShowFaq(!showFaq)}
          className="w-full flex items-center justify-between bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <i className="ri-question-line text-amber-400 text-xl" />
            <span className="text-white text-sm font-bold">Preguntas sobre buscar cuenta</span>
          </div>
          <i className={`ri-arrow-down-s-line text-gray-400 text-lg transition-transform ${showFaq ? 'rotate-180' : ''}`} />
        </button>
        {showFaq && (
          <div className="mt-3 space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
                <p className="text-white text-sm font-bold mb-1.5">{faq.q}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer link */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-gray-950 border-t border-gray-900 flex items-center justify-center gap-4">
        <button
          onClick={() => navigate('/mis-cuentas')}
          className="flex items-center gap-1.5 text-gray-600 hover:text-amber-400 text-xs transition-colors cursor-pointer"
        >
          <i className="ri-history-line" />
          Mis cuentas guardadas
        </button>
        <span className="text-gray-800">·</span>
        <button
          onClick={() => navigate('/menu')}
          className="flex items-center gap-1.5 text-gray-600 hover:text-amber-400 text-xs transition-colors cursor-pointer"
        >
          <i className="ri-restaurant-line" />
          Ver menú
        </button>
      </div>
    </div>
  );
}