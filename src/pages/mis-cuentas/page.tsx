import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabasePos } from '@/pages/pos/supabasePos';
import { usePageSEO } from '@/hooks/usePageSEO';
import { SITE_URL } from '@/lib/site-url';
import {
  getAccountHistory,
  clearAccountHistory,
  updateAccountInHistory,
  type AccountHistoryEntry,
} from '@/hooks/useAccountHistory';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285';

interface LiveAccount {
  id: number;
  status: 'open' | 'closed';
  total: number;
  itemCount: number;
  pendingItems: number;
}

const faqs = [
  {
    q: "¿Qué son las cuentas guardadas en La Cabrona?",
    a: "Las cuentas guardadas son un historial de tus pedidos que se almacenan automáticamente en el navegador de tu celular cada vez que haces un pedido en La Cabrona. Este sistema te permite revisar el estado de tus cuentas, ver el total acumulado, los productos que ordenaste y cuántos están pendientes de entrega, todo sin necesidad de buscar nuevamente.",
  },
  {
    q: "¿Cuántas cuentas se pueden guardar?",
    a: "El sistema guarda un máximo de 10 cuentas por dispositivo. Cuando llegas al límite, las cuentas más antiguas se eliminan automáticamente para dar espacio a las nuevas. Puedes borrar el historial completo en cualquier momento usando el botón de eliminar en la parte superior de la página.",
  },
  {
    q: "¿Se actualizan las cuentas en tiempo real?",
    a: "Sí, las cuentas abiertas se actualizan automáticamente en tiempo real. Cuando el mesero agrega nuevos productos a tu cuenta o marca algunos como entregados, verás los cambios instantáneamente en tu celular sin necesidad de recargar la página.",
  },
  {
    q: "¿Puedo ver mi cuenta desde otro celular?",
    a: "No, el historial de cuentas está vinculado únicamente al navegador de tu celular. Si cambias de dispositivo, no verás tus cuentas guardadas. Sin embargo, puedes buscar tu cuenta activa en el nuevo dispositivo usando tu nombre o número de mesa en la página de Buscar Mi Cuenta.",
  },
  {
    q: "¿Qué pasa si borro el historial?",
    a: "Al borrar el historial, se eliminan todas las cuentas guardadas en ese dispositivo. Esto no afecta las cuentas abiertas en el sistema del bar, solo borra el registro local de tu celular. Puedes buscar nuevamente tus cuentas activas en cualquier momento.",
  },
  {
    q: "¿Cómo sé si mi cuenta sigue abierta?",
    a: "Las cuentas abiertas se muestran con una barra verde y un indicador parpadeante. También verás el número de productos en camino. Las cuentas cerradas aparecen en gris y ya no se actualizan. Si una cuenta abierta se cierra, se mueve automáticamente a la sección de cuentas anteriores.",
  },
];

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`;
  if (hrs > 0) return `hace ${hrs}h ${mins % 60}m`;
  if (mins > 0) return `hace ${mins} min`;
  return 'justo ahora';
}

// Memoized card para evitar re-renders innecesarios
const AccountCard = memo(({ entry, liveData }: { entry: AccountHistoryEntry; liveData: Record<number, LiveAccount> }) => {
  const navigate = useNavigate();
  const live = liveData[entry.id];
  const status = live?.status ?? entry.lastStatus;
  const total = live?.total ?? entry.lastTotal;
  const isOpen = status === 'open';
  const pending = live?.pendingItems ?? 0;

  return (
    <button
      onClick={() => navigate(entry.url)}
      className="w-full text-left bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
    >
      {/* Status bar */}
      <div className={`h-1 w-full ${isOpen ? 'bg-green-500' : 'bg-gray-600'}`} />

      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          {/* Info izquierda */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOpen ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className={`text-xs font-bold uppercase tracking-wide ${isOpen ? 'text-green-400' : 'text-gray-500'}`}>
                {isOpen ? 'Abierta' : 'Cerrada'}
              </span>
              {isOpen && pending > 0 && (
                <span className="flex items-center gap-1 text-amber-400 text-xs font-bold bg-amber-500/15 px-2 py-0.5 rounded-full">
                  <i className="ri-loader-2-line animate-spin text-xs" />
                  {pending} en camino
                </span>
              )}
            </div>

            <p className="text-white text-2xl font-black leading-tight truncate">
              {entry.spot}
            </p>
            {entry.area && entry.area !== entry.spot && (
              <p className="text-gray-500 text-xs mt-0.5">{entry.area}</p>
            )}
            {entry.customer_name && (
              <p className="text-amber-400 text-sm mt-1 flex items-center gap-1">
                <i className="ri-user-line text-xs" />
                {entry.customer_name}
              </p>
            )}
          </div>

          {/* Total derecha */}
          <div className="text-right flex-shrink-0">
            <p className="text-gray-500 text-xs mb-0.5">Total</p>
            <p className={`text-2xl font-black ${isOpen ? 'text-amber-400' : 'text-gray-400'}`}>
              ${total.toFixed(2)}
            </p>
            {live && (
              <p className="text-gray-600 text-xs mt-0.5">
                {live.itemCount} producto{live.itemCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Footer de la card */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
          <span className="text-gray-600 text-xs flex items-center gap-1">
            <i className="ri-time-line" />
            {formatRelativeTime(entry.lastSeen)}
          </span>
          <span className={`flex items-center gap-1 text-xs font-semibold ${isOpen ? 'text-amber-500' : 'text-gray-500'}`}>
            {isOpen ? 'Ver cuenta' : 'Ver resumen'}
            <i className="ri-arrow-right-s-line" />
          </span>
        </div>
      </div>
    </button>
  );
});

AccountCard.displayName = 'AccountCard';

export default function MisCuentasPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<AccountHistoryEntry[]>([]);
  const [liveData, setLiveData] = useState<Record<number, LiveAccount>>();
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showFaq, setShowFaq] = useState(false);

  usePageSEO({
    title: 'Mis Cuentas | La Cabrona',
    description: 'Revisa tu historial de cuentas y consumo en La Cabrona Alitas & Beer de Zapopan.',
    canonicalUrl: `${SITE_URL}/mis-cuentas`,
    ogImage: LOGO_URL,
    keywords: 'historial de cuentas, La Cabrona, alitas, cerveza, Zapopan, consumo, pedidos',
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Inicio", "item": `${SITE_URL}/` },
          { "@type": "ListItem", "position": 2, "name": "Mis Cuentas", "item": `${SITE_URL}/mis-cuentas` }
        ]
      },
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${SITE_URL}/mis-cuentas`,
        "url": `${SITE_URL}/mis-cuentas`,
        "name": "Mis Cuentas | La Cabrona Alitas & Beer Zapopan",
        "description": "Historial de cuentas de consumo en La Cabrona Alitas & Beer Zapopan. Consulta tus cuentas abiertas y anteriores con totales en tiempo real.",
        "isPartOf": { "@id": `${SITE_URL}/#website` }
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "¿Qué son las cuentas guardadas en La Cabrona?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Las cuentas guardadas son un historial de tus pedidos que se almacenan automáticamente en el navegador de tu celular cada vez que haces un pedido en La Cabrona. Este sistema te permite revisar el estado de tus cuentas, ver el total acumulado y los productos que ordenaste."
            }
          },
          {
            "@type": "Question",
            "name": "¿Se actualizan las cuentas en tiempo real?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Sí, las cuentas abiertas se actualizan automáticamente en tiempo real. Cuando el mesero agrega nuevos productos a tu cuenta o marca algunos como entregados, verás los cambios instantáneamente en tu celular sin necesidad de recargar la página."
            }
          },
          {
            "@type": "Question",
            "name": "¿Cuántas cuentas se pueden guardar?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "El sistema guarda un máximo de 10 cuentas por dispositivo. Cuando llegas al límite, las cuentas más antiguas se eliminan automáticamente para dar espacio a las nuevas."
            }
          }
        ]
      }
    ],
  });

  const loadHistory = useCallback(() => {
    const h = getAccountHistory();
    setHistory(h);
    return h;
  }, []);

  const fetchLiveData = useCallback(async (entries: AccountHistoryEntry[]) => {
    if (entries.length === 0) { setLoading(false); return; }

    const ids = entries.map(e => e.id);
    const { data } = await supabasePos
      .from('pos_accounts')
      .select('id, status, pos_account_items(unit_price, quantity, delivered)')
      .in('id', ids);

    if (data) {
      const map: Record<number, LiveAccount> = {};
      data.forEach((acc: {
        id: number;
        status: 'open' | 'closed';
        pos_account_items: { unit_price: number; quantity: number; delivered: boolean }[];
      }) => {
        const items = acc.pos_account_items ?? [];
        const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
        const pending = items.filter(i => !i.delivered).length;
        map[acc.id] = {
          id: acc.id,
          status: acc.status,
          total,
          itemCount: items.length,
          pendingItems: pending,
        };
        updateAccountInHistory(acc.id, {
          lastTotal: total,
          lastStatus: acc.status,
          lastSeen: new Date().toISOString(),
        });
      });
      setLiveData(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const h = loadHistory();
    fetchLiveData(h);
  }, [loadHistory, fetchLiveData]);

  // Suscripción en tiempo real para las cuentas abiertas
  useEffect(() => {
    const openIds = history.filter(e => e.lastStatus === 'open').map(e => e.id);
    if (openIds.length === 0) return;

    const channel = supabasePos
      .channel('mis-cuentas-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_account_items' }, () => {
        fetchLiveData(history);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pos_accounts' }, () => {
        fetchLiveData(history);
      })
      .subscribe();

    return () => { supabasePos.removeChannel(channel); };
  }, [history, fetchLiveData]);

  const handleClear = useCallback(() => {
    clearAccountHistory();
    setHistory([]);
    setLiveData({});
    setShowClearConfirm(false);
  }, []);

  const openAccounts = history.filter(e => (liveData[e.id]?.status ?? e.lastStatus) === 'open');
  const closedAccounts = history.filter(e => (liveData[e.id]?.status ?? e.lastStatus) === 'closed');

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-5 pt-10 pb-5">
        <div className="flex items-center gap-4 mb-1">
          <img
            src={LOGO_URL}
            alt="La Cabrona"
            title="La Cabrona Alitas & Beer"
            className="w-11 h-11 rounded-full object-cover border-2 border-amber-500 flex-shrink-0"
            loading="lazy"
            decoding="async"
          />
          <div className="flex-1 min-w-0">
            <h1
              className="text-white font-bold text-lg leading-tight"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.08em' }}
            >
              MIS CUENTAS
            </h1>
            <p className="text-amber-500 text-xs font-bold tracking-widest">La Cabrona · Alitas &amp; Beer</p>
          </div>
          {history.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-gray-600 hover:text-red-400 cursor-pointer transition-colors p-2 rounded-xl active:bg-gray-800"
            >
              <i className="ri-delete-bin-line text-lg" />
            </button>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="px-4 pt-5 space-y-6">

        {/* Descripción introductoria para SEO — EXPANDIDA */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 mb-6">
          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            Aquí encuentras tu historial de cuentas de consumo en <strong className="text-white">La Cabrona Alitas &amp; Beer</strong>. El sistema guarda cada cuenta automáticamente en tu celular. Puedes revisar el estado de tus pedidos, el total acumulado y los productos pendientes. Todo se actualiza en tiempo real.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            ¿Cómo funciona? Cuando haces un pedido en el bar, el mesero registra tu cuenta en nuestro sistema POS. Tu celular guarda automáticamente un enlace a esa cuenta. Puedes ver cuántos productos has ordenado, cuántos están en camino y cuánto llevas gastado. Si tu cuenta sigue abierta, verás una barra verde parpadeante. Si ya se cerró, aparece en la sección de cuentas anteriores. El historial se guarda solo en este dispositivo, con un máximo de 10 cuentas. Si cambias de celular, puedes buscar tu cuenta activa usando tu nombre o número de mesa.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">
            Esta herramienta está diseñada para que tengas control total sobre tu experiencia de consumo. No necesitas memorizar qué pediste ni andar preguntando al mesero por el total. Todo está en tu celular, actualizado al segundo, accesible con un solo toque.
          </p>
        </section>

        {/* Sección: El Historial de Cuentas y Cómo Funciona */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 mb-6">
          <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
            <i className="ri-time-line text-amber-400" />
            El Historial de Cuentas y Cómo Funciona
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            El historial de cuentas es una funcionalidad exclusiva de <strong className="text-white">La Cabrona Alitas &amp; Beer</strong> que te permite llevar un registro completo de todas tus visitas al bar. Cada vez que haces un pedido y el mesero registra tu cuenta en nuestro sistema POS, tu celular almacena automáticamente un enlace a esa cuenta. No necesitas crear una cuenta de usuario ni iniciar sesión: el sistema funciona de forma anónima y local en tu dispositivo.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            El funcionamiento es sencillo pero potente. Cuando accedes a una cuenta desde el buscador o desde el menú, el navegador guarda el identificador de esa cuenta en el almacenamiento local del dispositivo. Desde ese momento, puedes volver a esa cuenta en cualquier momento sin tener que buscarla nuevamente. El sistema se encarga de consultar la información actualizada en nuestra base de datos cada vez que abres el historial, por lo que siempre ves el estado real de tu cuenta.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">
            Las cuentas se organizan automáticamente en dos categorías: cuentas abiertas y cuentas anteriores. Las abiertas son las que aún están activas en el bar, donde puedes seguir ordenando productos. Las anteriores son las que ya fueron cerradas y pagadas. Esta organización te permite distinguir fácilmente entre visitas actuales y visitas pasadas, manteniendo todo ordenado y accesible.
          </p>
        </section>

        {/* Sección: Ventajas de Usar el Historial de Cuentas */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 mb-6">
          <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
            <i className="ri-star-line text-amber-400" />
            Ventajas de Usar el Historial de Cuentas
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            Utilizar el historial de cuentas de <strong className="text-white">La Cabrona</strong> trae consigo múltiples beneficios que transforman tu experiencia en el bar. El primero es la <strong className="text-white">comodidad absoluta</strong>: olvídate de andar preguntando al mesero cuánto llevas gastado o si ya llegó tu orden. Con un solo toque en tu celular, tienes toda la información frente a ti, organizada y actualizada.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            Otra ventaja significativa es el <strong className="text-white">control presupuestario</strong>. Al poder ver el total acumulado en tiempo real, puedes decidir si quieres pedir algo más o si prefieres cerrar la cuenta en ese momento. Esto es especialmente útil cuando salen en grupo y cada persona quiere controlar su propio gasto. También puedes ver el desglose de productos y precios, lo que te da total claridad sobre tu consumo.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">
            Finalmente, el historial te permite <strong className="text-white">planificar futuras visitas</strong>. Al revisar tus cuentas anteriores, puedes recordar qué productos te gustaron más, cuánto gastaste en promedio y qué días o horarios funcionan mejor para ti. Es una herramienta de memoria digital que mejora cada visita sucesiva al bar, haciendo que tu experiencia sea más personalizada y satisfactoria.
          </p>
        </section>

        {/* Sección: Experiencia Completa en el Bar */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 mb-6">
          <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
            <i className="ri-restaurant-2-line text-amber-400" />
            Experiencia Completa en La Cabrona
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            <strong className="text-white">La Cabrona Alitas &amp; Beer</strong> no es solo un bar: es un destino de experiencias. Ubicado en Zapopan, Jalisco, nuestro establecimiento ofrece una combinación única de gastronomía de calidad, bebidas refrescantes y un ambiente diseñado para la diversión. Desde nuestras emblemáticas alitas de pollo en sabores clásicos y especiales hasta nuestra selección de cervezas de barril, latas, micheladas y preparados, cada elemento está pensado para que pases un momento inolvidable.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            El sistema de historial de cuentas es solo una parte de la experiencia digital que ofrecemos. También puedes explorar nuestro menú completo desde tu celular, ver las ofertas flash del día, hacer reservaciones para mesa o eventos especiales, y hasta jugar una partida de billar en nuestras mesas profesionales. Todo está integrado en un ecosistema pensado para que disfrutes al máximo sin complicaciones.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">
            Ya sea que vengas con un grupo grande para celebrar una ocasión especial, con tu pareja para una cena relajada, o solo para disfrutar de una cerveza tranquila después del trabajo, <strong className="text-white">La Cabrona</strong> tiene algo para ti. Y con el historial de cuentas, cada visita queda registrada para que tu próxima experiencia sea aún mejor. Nuestro compromiso es brindarte no solo excelente comida y bebida, sino también una experiencia de servicio moderna, transparente y sin complicaciones.
          </p>
        </section>

        {/* Sección: Consejos para Aprovechar tu Historial */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 mb-6">
          <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
            <i className="ri-lightbulb-line text-amber-400" />
            Consejos para Aprovechar tu Historial
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            Para sacar el máximo provecho a tu historial de cuentas en <strong className="text-white">La Cabrona</strong>, te compartimos algunos consejos prácticos. Primero, revisa el historial antes de ordenar una segunda ronda. Al ver el total acumulado, puedes decidir con mejor información si quieres seguir consumiendo o si ya es momento de cerrar. Esto te ayuda a mantener el control de tu presupuesto durante toda la visita.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            Segundo, usa el historial para recordar tus productos favoritos. Si en una visita anterior probaste una michelada especial o unas alitas con un salsa que te encantó, tu historial te ayuda a recordar qué pediste y cuánto costó. Así, en tu próxima visita, puedes pedir directamente lo que sabes que te gusta, sin tener que memorizar el menú completo.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">
            Tercero, mantén tu historial limpio. Si ya tienes muchas cuentas acumuladas y algunas son muy viejas, considera usar el botón de borrar historial para empezar fresco. Esto no afecta tus cuentas abiertas actuales, solo limpia el registro local. Un historial limpio carga más rápido y te permite enfocarte en las cuentas que realmente te interesan. Si necesitas buscar una cuenta antigua, siempre puedes usar el buscador de cuentas con tu nombre o mesa.
          </p>
        </section>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Cargando tus cuentas...</p>
          </div>
        )}

        {!loading && history.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-5">
              <i className="ri-receipt-line text-4xl text-gray-600" />
            </div>
            <p className="text-white text-xl font-bold mb-2">Sin cuentas guardadas</p>
            <p className="text-gray-500 text-sm leading-relaxed mb-3">
              Cuando hagas un pedido en La Cabrona y veas tu cuenta en este celular, aparecerá aquí automáticamente.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              ¿Ya tienes una cuenta y no la ves? Búscala por tu nombre o número de teléfono. También funciona para cuentas que ya fueron cerradas.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
              <Link
                to="/buscar-cuenta"
                className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3.5 rounded-2xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap active:scale-95"
              >
                <i className="ri-search-line" />
                Buscar por nombre o teléfono
              </Link>
              <Link
                to="/menu"
                className="flex items-center justify-center gap-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 px-6 py-3.5 rounded-2xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap active:scale-95"
              >
                <i className="ri-restaurant-line" />
                Ver el menú
              </Link>
            </div>
          </div>
        )}

        {!loading && openAccounts.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <h2 className="text-green-400 text-xs font-black uppercase tracking-widest">
                Cuentas abiertas ahora
              </h2>
              <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full">
                {openAccounts.length}
              </span>
            </div>
            <div className="space-y-3">
              {openAccounts.map(entry => (
                <AccountCard key={entry.id} entry={entry} liveData={liveData} />
              ))}
            </div>
          </section>
        )}

        {/* Banner: ¿Falta una cuenta? */}
        {!loading && history.length > 0 && (
          <Link
            to="/buscar-cuenta"
            className="flex items-center gap-3 bg-gray-900 border border-gray-800 hover:border-amber-500/40 rounded-2xl px-4 py-3.5 cursor-pointer transition-all active:scale-[0.98]"
          >
            <div className="w-9 h-9 bg-amber-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ri-search-line text-amber-400 text-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold">¿Falta una cuenta?</p>
              <p className="text-gray-500 text-xs mt-0.5">Busca por tu nombre o número de teléfono para encontrar cuentas que no aparecen aquí, incluso las que ya fueron cerradas.</p>
            </div>
            <i className="ri-arrow-right-s-line text-gray-500 text-lg flex-shrink-0" />
          </Link>
        )}

        {!loading && closedAccounts.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-gray-500 text-xs font-black uppercase tracking-widest">
                Cuentas anteriores
              </h2>
              <span className="bg-gray-800 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">
                {closedAccounts.length}
              </span>
            </div>
            <div className="space-y-3">
              {closedAccounts.map(entry => (
                <AccountCard key={entry.id} entry={entry} liveData={liveData} />
              ))}
            </div>
          </section>
        )}

        {!loading && history.length > 0 && (
          <p className="text-center text-gray-700 text-xs pt-2">
            Solo se guarda en este celular · máx. 10 cuentas
          </p>
        )}

        {/* FAQs */}
        <div className="pt-4 pb-2">
          <button
            onClick={() => setShowFaq(!showFaq)}
            className="w-full flex items-center justify-between bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <i className="ri-question-line text-amber-400 text-xl" />
              <span className="text-white text-sm font-bold">Preguntas sobre mis cuentas</span>
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
      </div>

      {/* Modal confirmar borrar */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end px-4 pb-8">
          <div className="w-full bg-gray-900 border border-gray-700 rounded-3xl p-5 space-y-4">
            <div className="text-center">
              <i className="ri-delete-bin-line text-red-400 text-3xl" />
              <p className="text-white font-bold text-base mt-2">¿Borrar historial?</p>
              <p className="text-gray-500 text-sm mt-1">Se eliminarán todas las cuentas guardadas en este celular</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-2xl text-sm font-bold cursor-pointer transition-colors active:bg-gray-700 whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                Sí, borrar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}