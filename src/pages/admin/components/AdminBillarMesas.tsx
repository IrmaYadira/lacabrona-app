import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { BillarMesa } from "@/types/billar";

type EstadoMesa = 'disponible' | 'ocupada' | 'reservada';

interface Mesa {
  id: number;
  numero: number;
  estado: EstadoMesa;
  etiqueta: string | null;
  updated_at: string;
}

const ESTADOS: { value: EstadoMesa; label: string; color: string; bg: string; dot: string }[] = [
  { value: 'disponible', label: 'Disponible', color: 'text-green-700', bg: 'bg-green-100 border-green-300 hover:bg-green-200', dot: 'bg-green-500' },
  { value: 'ocupada', label: 'Ocupada', color: 'text-red-700', bg: 'bg-red-100 border-red-300 hover:bg-red-200', dot: 'bg-red-500' },
  { value: 'reservada', label: 'Reservada', color: 'text-amber-700', bg: 'bg-amber-100 border-amber-300 hover:bg-amber-200', dot: 'bg-amber-500' },
];

const CARD_COLORS: Record<EstadoMesa, string> = {
  disponible: 'border-green-300 bg-green-50',
  ocupada: 'border-red-300 bg-red-50',
  reservada: 'border-amber-300 bg-amber-50',
};

export default function AdminBillarMesas() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editEtiqueta, setEditEtiqueta] = useState('');
  const [saving, setSaving] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchMesas = async () => {
    const { data } = await supabase
      .from('billar_mesas')
      .select('*')
      .order('numero');
    if (data) {
      setMesas(data as Mesa[]);
      setLastUpdate(new Date());
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMesas();

    const channel = supabase
      .channel('admin-billar-mesas')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'billar_mesas' }, () => {
        fetchMesas();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateEstado = async (mesa: Mesa, nuevoEstado: EstadoMesa) => {
    setSaving(mesa.id);
    const { error } = await supabase
      .from('billar_mesas')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', mesa.id);
    if (!error) {
      setMesas(prev => prev.map(m => m.id === mesa.id ? { ...m, estado: nuevoEstado } : m));
      setLastUpdate(new Date());
    }
    setSaving(null);
  };

  const startEditEtiqueta = (mesa: Mesa) => {
    setEditingId(mesa.id);
    setEditEtiqueta(mesa.etiqueta ?? '');
  };

  const saveEtiqueta = async (mesaId: number) => {
    setSaving(mesaId);
    const etiqueta = editEtiqueta.trim() || null;
    const { error } = await supabase
      .from('billar_mesas')
      .update({ etiqueta, updated_at: new Date().toISOString() })
      .eq('id', mesaId);
    if (!error) {
      setMesas(prev => prev.map(m => m.id === mesaId ? { ...m, etiqueta } : m));
      setLastUpdate(new Date());
    }
    setEditingId(null);
    setSaving(null);
  };

  const disponibles = mesas.filter(m => m.estado === 'disponible').length;
  const ocupadas = mesas.filter(m => m.estado === 'ocupada').length;
  const reservadas = mesas.filter(m => m.estado === 'reservada').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 flex items-center justify-center">
          <i className="ri-loader-4-line text-amber-500 text-2xl animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <span className="text-xl">🎱</span> Mesas de Billar
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Actualiza el estado en tiempo real. Los clientes lo ven al instante en la página de renta.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-time-line text-gray-400" />
          </div>
          {lastUpdate ? `Actualizado ${lastUpdate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : 'Cargando...'}
          <button
            onClick={fetchMesas}
            className="ml-1 w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded cursor-pointer transition-colors"
          >
            <i className="ri-refresh-line text-gray-500 text-xs" />
          </button>
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-black text-green-700">{disponibles}</p>
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Disponibles</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-black text-red-700">{ocupadas}</p>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Ocupadas</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-black text-amber-700">{reservadas}</p>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Reservadas</p>
        </div>
      </div>

      {/* Mesas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {mesas.map(mesa => {
          const estadoInfo = ESTADOS.find(e => e.value === mesa.estado)!;
          const isEditing = editingId === mesa.id;
          const isSaving = saving === mesa.id;

          return (
            <div
              key={mesa.id}
              className={`rounded-xl border-2 p-5 transition-all ${CARD_COLORS[mesa.estado]}`}
            >
              {/* Mesa header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">🎱</div>
                  <div>
                    <p className="font-black text-gray-900 text-base">Mesa {mesa.numero}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-2 h-2 rounded-full ${estadoInfo.dot}`} />
                      <span className={`text-xs font-bold uppercase tracking-wide ${estadoInfo.color}`}>
                        {estadoInfo.label}
                      </span>
                    </div>
                  </div>
                </div>
                {isSaving && (
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-loader-4-line text-gray-400 text-sm animate-spin" />
                  </div>
                )}
              </div>

              {/* Botones de estado */}
              <div className="flex gap-2 mb-3">
                {ESTADOS.map(est => (
                  <button
                    key={est.value}
                    onClick={() => updateEstado(mesa, est.value)}
                    disabled={mesa.estado === est.value || isSaving}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border cursor-pointer transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                      mesa.estado === est.value
                        ? `${est.bg} ${est.color} border-current font-black ring-2 ring-offset-1 ring-current/30`
                        : `bg-white/60 text-gray-600 border-gray-200 hover:bg-white`
                    }`}
                  >
                    {est.label}
                  </button>
                ))}
              </div>

              {/* Etiqueta */}
              <div>
                {isEditing ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editEtiqueta}
                      onChange={e => setEditEtiqueta(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEtiqueta(mesa.id)}
                      placeholder="Ej: Hasta las 10pm, Grupo Martínez..."
                      maxLength={40}
                      autoFocus
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      onClick={() => saveEtiqueta(mesa.id)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditEtiqueta(mesa)}
                    className="w-full flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition-colors py-1"
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-edit-line text-xs" />
                    </div>
                    <span className={mesa.etiqueta ? 'text-gray-600 italic' : ''}>
                      {mesa.etiqueta || 'Agregar nota (ej: Hasta las 10pm)'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tip */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <div className="w-5 h-5 flex items-center justify-center mt-0.5">
          <i className="ri-lightbulb-line text-amber-600 text-sm" />
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">
          Los cambios se reflejan <strong>en tiempo real</strong> para los clientes que visiten la página de renta de billar. 
          Puedes agregar notas como &ldquo;Hasta las 10pm&rdquo; o &ldquo;Grupo Martínez&rdquo; para dar más contexto.
        </p>
      </div>
    </div>
  );
}