import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface PushSub {
  id: number;
  account_id: number | null;
  endpoint: string;
  created_at: string;
}

interface SwState {
  state: string;
  scope: string;
  scriptUrl: string;
  active: boolean;
}

export default function PushDiagnosticsPanel() {
  const [subs, setSubs] = useState<PushSub[]>([]);
  const [loading, setLoading] = useState(false);
  const [testAccountId, setTestAccountId] = useState('');
  const [testTitle, setTestTitle] = useState('🧪 Prueba Push');
  const [testBody, setTestBody] = useState('Esta es una notificación de prueba desde el panel de admin.');
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sendError, setSendError] = useState('');
  const [browserInfo, setBrowserInfo] = useState({
    swSupported: false,
    pushSupported: false,
    notificationPermission: 'default' as 'granted' | 'denied' | 'default' | 'unknown',
    swState: null as SwState | null,
    isPreview: false,
  });

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, account_id, endpoint, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) {
      setSubs(data as PushSub[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSubs();

    // Detectar estado del navegador
    const detectBrowser = async () => {
      const swSupported = 'serviceWorker' in navigator;
      const pushSupported = 'PushManager' in window;
      let notificationPermission: 'granted' | 'denied' | 'default' | 'unknown' = 'unknown';
      try {
        if ('Notification' in window) {
          notificationPermission = Notification.permission;
        }
      } catch { /* noop */ }

      let swState: SwState | null = null;
      if (swSupported) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          const reg = regs.find(r => r.scope.includes(window.location.origin));
          if (reg) {
            swState = {
              state: reg.active?.state ?? 'unknown',
              scope: reg.scope,
              scriptUrl: reg.active?.scriptURL ?? reg.installing?.scriptURL ?? 'unknown',
              active: !!reg.active,
            };
          }
        } catch { /* noop */ }
      }

      const isPreview = window.location.hostname.includes('readdy.ai');

      setBrowserInfo({
        swSupported,
        pushSupported,
        notificationPermission,
        swState,
        isPreview,
      });
    };

    detectBrowser();
  }, [fetchSubs]);

  const handleSendTest = async () => {
    const accountId = Number(testAccountId.trim());
    if (!accountId || Number.isNaN(accountId)) {
      setSendStatus('error');
      setSendError('Ingresa un ID de cuenta válido.');
      return;
    }
    setSendStatus('sending');
    setSendError('');
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          account_id: accountId,
          title: testTitle,
          body: testBody,
          tag: `test-${Date.now()}`,
          data: { url: '/', test: true },
        },
      });
      if (error) {
        setSendStatus('error');
        setSendError(error.message || 'Error desconocido');
        return;
      }
      setSendStatus('sent');
      setTimeout(() => setSendStatus('idle'), 4000);
    } catch (err) {
      setSendStatus('error');
      setSendError(err instanceof Error ? err.message : 'Error de red');
    }
  };

  const truncateEndpoint = (ep: string) => {
    if (ep.length <= 60) return ep;
    return ep.slice(0, 30) + '...' + ep.slice(-25);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Estado del navegador */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
          <i className="ri-computer-line text-amber-500" />
          Estado del navegador (este dispositivo)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2.5">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${browserInfo.swSupported ? 'bg-green-500' : 'bg-red-500'}`} />
            <div>
              <p className="text-xs font-bold text-gray-700">ServiceWorker</p>
              <p className="text-[11px] text-gray-500">{browserInfo.swSupported ? 'Soportado' : 'No soportado'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2.5">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${browserInfo.pushSupported ? 'bg-green-500' : 'bg-red-500'}`} />
            <div>
              <p className="text-xs font-bold text-gray-700">Push API</p>
              <p className="text-[11px] text-gray-500">{browserInfo.pushSupported ? 'Soportado' : 'No soportado'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2.5">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${browserInfo.notificationPermission === 'granted' ? 'bg-green-500' : browserInfo.notificationPermission === 'denied' ? 'bg-red-500' : 'bg-amber-500'}`} />
            <div>
              <p className="text-xs font-bold text-gray-700">Permiso Notificaciones</p>
              <p className="text-[11px] text-gray-500">{browserInfo.notificationPermission === 'granted' ? 'Concedido' : browserInfo.notificationPermission === 'denied' ? 'Denegado' : browserInfo.notificationPermission === 'default' ? 'Sin decidir' : 'Desconocido'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2.5">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${browserInfo.isPreview ? 'bg-amber-500' : 'bg-green-500'}`} />
            <div>
              <p className="text-xs font-bold text-gray-700">Entorno</p>
              <p className="text-[11px] text-gray-500">{browserInfo.isPreview ? 'Preview Readdy (sw.js no disponible)' : 'Producción / Dominio propio'}</p>
            </div>
          </div>
        </div>
        {browserInfo.swState && (
          <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-xs font-bold text-gray-700 mb-1">ServiceWorker registrado</p>
            <p className="text-[11px] text-gray-500 font-mono">Estado: {browserInfo.swState.state} | Scope: {browserInfo.swState.scope}</p>
            <p className="text-[11px] text-gray-500 font-mono">Script: {browserInfo.swState.scriptUrl}</p>
          </div>
        )}
        {!browserInfo.swSupported && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            <p className="text-xs font-bold text-red-700">⚠️ Este navegador no soporta ServiceWorkers</p>
            <p className="text-[11px] text-red-600">Las notificaciones push no funcionarán aquí. Usa Chrome, Edge, Firefox o Safari en macOS Ventura+.</p>
          </div>
        )}
        {browserInfo.isPreview && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <p className="text-xs font-bold text-amber-800">⚠️ Estás en preview de Readdy</p>
            <p className="text-[11px] text-amber-700">El archivo sw.js no se sirve como JavaScript en preview. Las push solo funcionarán en el dominio publicado (barlacabrona.com).</p>
          </div>
        )}
      </div>

      {/* Enviar notificación de prueba */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
          <i className="ri-send-plane-fill text-green-500" />
          Enviar notificación de prueba
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">ID de cuenta (account_id en push_subscriptions)</label>
            <input
              type="number"
              value={testAccountId}
              onChange={(e) => setTestAccountId(e.target.value)}
              placeholder="Ej: 123"
              className="w-full max-w-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">La cuenta debe tener una suscripción push activa en la tabla.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Título</label>
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Mensaje</label>
              <input
                type="text"
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <button
            onClick={handleSendTest}
            disabled={sendStatus === 'sending' || !testAccountId.trim()}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold cursor-pointer transition-all whitespace-nowrap ${
              sendStatus === 'sending'
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : sendStatus === 'sent'
                ? 'bg-green-500 text-white'
                : sendStatus === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-white active:scale-95'
            }`}
          >
            {sendStatus === 'sending' && <i className="ri-loader-4-line animate-spin" />}
            {sendStatus === 'sent' && <i className="ri-checkbox-circle-fill" />}
            {sendStatus === 'error' && <i className="ri-error-warning-fill" />}
            {sendStatus === 'idle' && <i className="ri-send-plane-line" />}
            {sendStatus === 'sending' ? 'Enviando...' : sendStatus === 'sent' ? '¡Enviada!' : sendStatus === 'error' ? 'Error al enviar' : 'Enviar push de prueba'}
          </button>
          {sendError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{sendError}</p>
          )}
        </div>
      </div>

      {/* Suscripciones en la base de datos */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <i className="ri-database-2-line text-blue-500" />
            Suscripciones push en base de datos
          </h3>
          <button
            onClick={fetchSubs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`} />
            Recargar
          </button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
            <i className="ri-loader-4-line animate-spin" />
            Cargando suscripciones...
          </div>
        ) : subs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <i className="ri-notification-off-line text-2xl mb-2 block" />
            <p className="text-sm">No hay suscripciones push registradas</p>
            <p className="text-xs mt-1">Los clientes deben aceptar notificaciones desde el menú digital para aparecer aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs uppercase">ID</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs uppercase">Account</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs uppercase">Endpoint</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs uppercase">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((sub) => (
                  <tr key={sub.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-3 py-2 text-gray-500 font-mono text-xs">#{sub.id}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-bold">
                        <i className="ri-table-line" />
                        {sub.account_id ?? 'Sin mesa'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-[11px] font-mono max-w-[300px] truncate" title={sub.endpoint}>
                      {truncateEndpoint(sub.endpoint)}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-[11px]">
                      {new Date(sub.created_at).toLocaleString('es-MX')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-400 mt-2 text-right">Total: {subs.length} suscripción{subs.length !== 1 ? 'es' : ''}</p>
          </div>
        )}
      </div>

      {/* Instrucciones */}
      <div className="bg-gray-900 rounded-xl p-5 text-white">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <i className="ri-information-line text-amber-400" />
          Cómo probar en producción
        </h3>
        <ol className="space-y-2 text-xs text-gray-300">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</span>
            <span>Publica el sitio en tu dominio (barlacabrona.com). En preview de Readdy el ServiceWorker no se sirve como JS.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">2</span>
            <span>Abre el menú digital desde un celular o laptop con Chrome/Edge/Safari.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</span>
            <span>Acepta las notificaciones cuando el navegador pregunte. Eso registra el dispositivo en la tabla <code className="text-amber-400 bg-gray-800 px-1 rounded">push_subscriptions</code>.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">4</span>
            <span>Copia el <code className="text-amber-400 bg-gray-800 px-1 rounded">account_id</code> de esa suscripción y pégalo arriba en &quot;Enviar notificación de prueba&quot;.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">5</span>
            <span>Toca &quot;Enviar push de prueba&quot;. Si todo está bien, el celular recibe la notificación incluso con la pantalla apagada.</span>
          </li>
        </ol>
      </div>
    </div>
  );
}