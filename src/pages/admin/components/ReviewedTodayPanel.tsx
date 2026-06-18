import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';

interface ReviewedCheck {
  id: number;
  account_id: number;
  checked_at: string;
  checked_by: string | null;
  notes: string | null;
  created_at: string;
}

interface AccountInfo {
  id: number;
  spot: string;
  area: string;
  customer_name: string | null;
  status: string;
}

interface EnrichedCheck extends ReviewedCheck {
  account?: AccountInfo;
}

function formatTimeMX(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function timeAgoMX(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Justo ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return formatTimeMX(iso);
}

export default function ReviewedTodayPanel() {
  const [checks, setChecks] = useState<ReviewedCheck[]>([]);
  const [accounts, setAccounts] = useState<Record<number, AccountInfo>>();
  const [loading, setLoading] = useState(true);
  const [selectedCheck, setSelectedCheck] = useState<EnrichedCheck | null>(null);
  const [confirmUnmark, setConfirmUnmark] = useState<EnrichedCheck | null>(null);
  const [unmarking, setUnmarking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: checksData } = await supabasePos
      .from('pos_abandoned_checks')
      .select('*')
      .gte('checked_at', `${today}T00:00:00`)
      .order('checked_at', { ascending: false });

    if (checksData) {
      setChecks(checksData as ReviewedCheck[]);

      const accountIds = [...new Set((checksData as ReviewedCheck[]).map(c => c.account_id))];
      if (accountIds.length > 0) {
        const { data: accData } = await supabasePos
          .from('pos_accounts')
          .select('id, spot, area, customer_name, status')
          .in('id', accountIds);
        if (accData) {
          const map: Record<number, AccountInfo> = {};
          (accData as AccountInfo[]).forEach(a => { map[a.id] = a; });
          setAccounts(map);
        }
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabasePos
      .channel('reviewed-today-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_abandoned_checks' }, fetchData)
      .subscribe();
    return () => { supabasePos.removeChannel(channel); };
  }, [fetchData]);

  const enriched = useMemo<EnrichedCheck[]>(() => {
    return checks.map(c => ({ ...c, account: accounts[c.account_id] }));
  }, [checks, accounts]);

  const stats = useMemo(() => {
    const total = checks.length;
    const byStaff: Record<string, number> = {};
    const byHour: Record<number, number> = {};

    checks.forEach(c => {
      const name = c.checked_by || 'Sin nombre';
      byStaff[name] = (byStaff[name] || 0) + 1;

      const hour = new Date(c.checked_at).getHours();
      byHour[hour] = (byHour[hour] || 0) + 1;
    });

    const lastReview = checks.length > 0 ? checks[0].checked_at : null;
    const topStaff = Object.entries(byStaff).sort((a, b) => b[1] - a[1]).slice(0, 3);

    return { total, byStaff, byHour, lastReview, topStaff };
  }, [checks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Revisadas hoy</p>
          <p className="text-2xl font-black text-green-700 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Última revisión</p>
          <p className="text-lg font-black text-gray-900 mt-1">
            {stats.lastReview ? timeAgoMX(stats.lastReview) : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:col-span-2">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Top revisores</p>
          <div className="flex flex-wrap gap-2">
            {stats.topStaff.length === 0 ? (
              <span className="text-xs text-gray-400">Sin datos aún</span>
            ) : (
              stats.topStaff.map(([name, count]) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-full text-xs font-semibold text-amber-700"
                >
                  <i className="ri-user-line" />
                  {name} · {count}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Distribution by hour */}
      {stats.total > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <i className="ri-bar-chart-grouped-line text-amber-500" />
            Revisión por hora
          </h3>
          <div className="flex items-end gap-1 h-24">
            {Array.from({ length: 24 }, (_, i) => {
              const count = stats.byHour[i] || 0;
              const max = Math.max(...Object.values(stats.byHour), 1);
              const pct = (count / max) * 100;
              const isNow = i === new Date().getHours();
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="relative w-full flex items-end justify-center h-16">
                    {count > 0 && (
                      <div
                        className={`w-full rounded-t-md transition-all ${isNow ? 'bg-amber-400' : 'bg-amber-200'}`}
                        style={{ height: `${pct}%` }}
                        title={`${i}:00 — ${count} revisada${count !== 1 ? 's' : ''}`}
                      />
                    )}
                  </div>
                  <span className={`text-[10px] font-medium ${isNow ? 'text-amber-600 font-bold' : 'text-gray-400'}`}>
                    {i}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <i className="ri-check-double-line text-amber-500" />
            Historial de revisiones
            {enriched.length > 0 && (
              <span className="text-xs font-normal text-gray-400">({enriched.length})</span>
            )}
          </h3>
        </div>

        {enriched.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <i className="ri-check-double-line text-4xl text-green-400 mb-3" />
            <p className="text-gray-500 font-medium">Aún no hay mesas revisadas hoy</p>
            <p className="text-gray-400 text-sm mt-1">Las mesas que marques como "Revisada" aparecerán aquí</p>
          </div>
        ) : (
          enriched.map((check) => {
            const account = check.account;
            return (
              <div
                key={check.id}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="ri-check-double-line text-green-600 text-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-sm">
                        {account ? account.spot : `Mesa #${check.account_id}`}
                      </span>
                      {account?.area && (
                        <span className="text-xs text-gray-400 capitalize">· {account.area}</span>
                      )}
                      {account?.customer_name && (
                        <span className="text-xs text-gray-500">{account.customer_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-green-600 font-semibold">
                        <i className="ri-user-line mr-1" />
                        {check.checked_by || 'Sin nombre'}
                      </span>
                      <span className="text-xs text-gray-400">
                        <i className="ri-time-line mr-1" />
                        {formatTimeMX(check.checked_at)} · {timeAgoMX(check.checked_at)}
                      </span>
                      {account?.status && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          account.status === 'open'
                            ? 'bg-green-50 text-green-600 border border-green-200'
                            : 'bg-gray-50 text-gray-500 border border-gray-200'
                        }`}>
                          {account.status === 'open' ? 'Abierta' : 'Cerrada'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setConfirmUnmark(check)}
                      className="px-3 py-1.5 bg-white border border-red-200 hover:border-red-400 text-red-600 hover:text-red-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-close-circle-line mr-1" />
                      Desmarcar
                    </button>
                    {check.notes && (
                      <button
                        onClick={() => setSelectedCheck(check)}
                        className="px-3 py-1.5 bg-white border border-gray-200 hover:border-amber-400 text-gray-700 hover:text-amber-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <i className="ri-sticky-note-line mr-1" />
                        Ver nota
                      </button>
                    )}
                  </div>
                </div>
                {check.notes && (
                  <div className="px-4 pb-3 pt-0">
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                      <i className="ri-chat-3-line mr-1 text-gray-400" />
                      {check.notes}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Note modal */}
      {selectedCheck && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
                <i className="ri-sticky-note-line text-amber-600 text-lg" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm">Nota de revisión</h3>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Mesa:</span>{' '}
                {selectedCheck.account?.spot || `Mesa #${selectedCheck.account_id}`}
              </p>
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Revisor:</span>{' '}
                {selectedCheck.checked_by || 'Sin nombre'}
              </p>
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Fecha:</span>{' '}
                {formatTimeMX(selectedCheck.checked_at)}
              </p>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-sm text-gray-800">{selectedCheck.notes}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedCheck(null)}
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Unmark confirmation modal */}
      {confirmUnmark && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
                <i className="ri-close-circle-line text-red-600 text-lg" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm">¿Desmarcar revisión?</h3>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Mesa:</span>{' '}
                {confirmUnmark.account?.spot || `Mesa #${confirmUnmark.account_id}`}
              </p>
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Revisor:</span>{' '}
                {confirmUnmark.checked_by || 'Sin nombre'}
              </p>
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Fecha:</span>{' '}
                {formatTimeMX(confirmUnmark.checked_at)}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Al desmarcar, esta mesa volverá a aparecer en las alertas de abandono si aplica.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmUnmark(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setUnmarking(true);
                  await supabasePos.from('pos_abandoned_checks').delete().eq('id', confirmUnmark.id);
                  setConfirmUnmark(null);
                  setUnmarking(false);
                  setToast(`Mesa ${confirmUnmark.account?.spot || `#${confirmUnmark.account_id}`} desmarcada correctamente`);
                  setTimeout(() => setToast(null), 3000);
                }}
                disabled={unmarking}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
              >
                {unmarking ? 'Desmarcando...' : 'Sí, desmarcar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast de éxito */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg shadow-gray-900/20 flex items-center gap-2 animate-bounce">
            <i className="ri-check-line text-green-400" />
            <span className="text-sm font-semibold">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}