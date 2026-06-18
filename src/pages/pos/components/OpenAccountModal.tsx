import { useState, useEffect, useCallback } from 'react';
import { supabasePos } from '../supabasePos';
import { SPOTS, AREA_LABELS, type Area, type Spot } from '../types';

interface OpenAccountModalProps {
  onConfirm: (data: {
    area: Area;
    spot: string;
    name?: string;
    phone?: string;
    zona?: string;
    customerId?: number;
  }) => void;
  onClose: () => void;
}

interface PosCustomer {
  id: number;
  name: string;
  phone?: string;
  visit_count: number;
  total_spent: number;
  last_visit?: string;
}

const ZONA_OPTIONS = [
  { value: '', label: 'Sin zona', icon: 'ri-map-pin-line' },
  { value: 'Barra', label: 'Barra', icon: 'ri-goblet-line' },
  { value: 'Sillón', label: 'Sillón', icon: 'ri-sofa-line' },
  { value: 'Periquera', label: 'Periquera', icon: 'ri-bar-chart-grouped-line' },
  { value: 'Terraza', label: 'Terraza', icon: 'ri-sun-line' },
  { value: 'VIP', label: 'VIP', icon: 'ri-vip-crown-line' },
  { value: 'Interior', label: 'Interior', icon: 'ri-door-line' },
];

const AREA_ORDER: Area[] = ['principal', 'af1', 'af2'];

export default function OpenAccountModal({ onConfirm, onClose }: OpenAccountModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [zona, setZona] = useState('');
  // Step 3 — cliente
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [searchResults, setSearchResults] = useState<PosCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<PosCustomer | null>(null);
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [searching, setSearching] = useState(false);
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const fetchRecent = useCallback(async () => {
    const { data } = await supabasePos
      .from('pos_customers')
      .select('id, name, phone, visit_count, total_spent, last_visit')
      .order('last_visit', { ascending: false, nullsFirst: false })
      .limit(6);
    setCustomers((data ?? []) as PosCustomer[]);
  }, []);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) { setSearchResults([]); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data } = await supabasePos
        .from('pos_customers')
        .select('id, name, phone, visit_count, total_spent, last_visit')
        .or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
        .limit(8);
      setSearchResults((data ?? []) as PosCustomer[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSelectCustomer = (cust: PosCustomer) => {
    setSelectedCustomer(cust);
    setSearch('');
    setSearchResults([]);
  };

  const handleConfirm = () => {
    if (!selectedSpot) return;
    onConfirm({
      area: selectedSpot.area,
      spot: selectedSpot.label,
      zona: zona || undefined,
    });
  };

  const handleConfirmWithCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpot) return;

    if (selectedCustomer) {
      onConfirm({
        area: selectedSpot.area,
        spot: selectedSpot.label,
        name: selectedCustomer.name,
        phone: selectedCustomer.phone,
        zona: zona || undefined,
        customerId: selectedCustomer.id,
      });
      return;
    }

    if (mode === 'new') {
      let valid = true;
      setNameError('');
      setPhoneError('');

      if (!name.trim()) { setNameError('El nombre es obligatorio'); valid = false; }
      const phoneClean = phone.trim().replace(/\s/g, '');
      if (!phoneClean) {
        setPhoneError('El celular es obligatorio');
        valid = false;
      } else if (phoneClean.length < 8) {
        setPhoneError('Ingresa un número válido (mín. 8 dígitos)');
        valid = false;
      }

      if (!valid) return;
      onConfirm({
        area: selectedSpot.area,
        spot: selectedSpot.label,
        name: name.trim(),
        phone: phone.trim(),
        zona: zona || undefined,
      });
    }
  };

  const displayResults = search.trim() ? searchResults : customers;
  const showingRecent = !search.trim();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Step 1: Spot picker
  const grouped = AREA_ORDER.map(area => ({
    area,
    label: AREA_LABELS[area],
    spots: SPOTS.filter(s => s.area === area),
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3 flex-shrink-0">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <i className="ri-store-3-line text-amber-600 text-lg" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">
              {step === 1 && 'Abrir Cuenta — Paso 1 de 2'}
              {step === 2 && 'Abrir Cuenta — Paso 2 de 2'}
              {step === 3 && 'Asignar Cliente'}
            </h3>
            <p className="text-xs text-gray-500">
              {step === 1 && 'Selecciona la mesa, barra o sillón'}
              {step === 2 && '¿Esta cuenta tiene cliente asignado?'}
              {step === 3 && 'Busca o registra al cliente'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-gray-400" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 pb-3 flex-shrink-0">
          <div className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-amber-500' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-amber-500' : 'bg-gray-200'}`} />
          {step === 3 && <div className={`flex-1 h-1 rounded-full ${step >= 3 ? 'bg-amber-500' : 'bg-gray-200'}`} />}
        </div>

        {/* ── STEP 1: Seleccionar Spot ── */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            {/* Zona selector */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                <i className="ri-map-pin-2-line mr-1 text-amber-500" />
                Zona / Ubicación <span className="text-gray-400 font-normal normal-case">(opcional)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ZONA_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setZona(opt.value)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full border-2 text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                      zona === opt.value
                        ? 'border-amber-500 bg-amber-500 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-amber-300 hover:text-amber-700'
                    }`}
                  >
                    <i className={`${opt.icon} text-xs`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Spot picker */}
            <div className="space-y-4">
              {grouped.map(({ area, label, spots }) => (
                <div key={area}>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</h4>
                  <div className="flex flex-wrap gap-2">
                    {spots.map(spot => {
                      const isSelected = selectedSpot?.id === spot.id;
                      return (
                        <button
                          key={spot.id}
                          onClick={() => setSelectedSpot(spot)}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-all whitespace-nowrap
                            ${isSelected
                              ? 'bg-amber-500 text-white border-amber-500 ring-2 ring-amber-300'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-amber-50 hover:border-amber-300'
                            }`}
                        >
                          {spot.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: ¿Cliente? ── */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col">
            {/* Selected spot summary */}
            {selectedSpot && (
              <div className="mb-4 bg-amber-50 border-2 border-amber-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-map-pin-2-line text-white text-lg" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{selectedSpot.label}</p>
                  <p className="text-xs text-gray-500">{AREA_LABELS[selectedSpot.area]}</p>
                  {zona && <p className="text-xs text-amber-600 font-medium">{zona}</p>}
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="ml-auto text-xs text-amber-600 hover:text-amber-700 font-semibold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-arrow-left-line mr-1" />
                  Cambiar
                </button>
              </div>
            )}

            <div className="space-y-3 flex-1">
              {/* Opción 1: Sin cliente */}
              <button
                onClick={handleConfirm}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 cursor-pointer transition-all text-left"
              >
                <div className="w-11 h-11 flex items-center justify-center bg-gray-300 rounded-xl flex-shrink-0">
                  <i className="ri-user-received-2-line text-white text-xl" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">Comanda sin cliente</p>
                  <p className="text-xs text-gray-500 mt-0.5">La cuenta se identifica por la mesa/barra. El cliente no recibe notificaciones.</p>
                </div>
                <i className="ri-arrow-right-line text-gray-400 flex-shrink-0" />
              </button>

              {/* Opción 2: Con cliente */}
              <button
                onClick={() => setStep(3)}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-amber-300 bg-amber-50 hover:border-amber-500 hover:bg-amber-100 cursor-pointer transition-all text-left"
              >
                <div className="w-11 h-11 flex items-center justify-center bg-amber-500 rounded-xl flex-shrink-0">
                  <i className="ri-user-add-line text-white text-xl" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">Asignar cliente</p>
                  <p className="text-xs text-gray-500 mt-0.5">Busca en el directorio o registra uno nuevo. El cliente recibe notificaciones y acumula puntos.</p>
                </div>
                <i className="ri-arrow-right-line text-gray-400 flex-shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Buscar/Registrar Cliente ── */}
        {step === 3 && (
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            {/* Selected spot summary */}
            {selectedSpot && (
              <div className="mb-3 bg-amber-50 border-2 border-amber-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-map-pin-2-line text-white text-sm" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{selectedSpot.label}</p>
                  <p className="text-xs text-gray-500">{AREA_LABELS[selectedSpot.area]}</p>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="ml-auto text-xs text-amber-600 hover:text-amber-700 font-semibold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-arrow-left-line mr-1" />
                  Volver
                </button>
              </div>
            )}

            <form onSubmit={handleConfirmWithCustomer}>
              {selectedCustomer ? (
                <div className="pb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cliente seleccionado</p>
                  <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-base">{selectedCustomer.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{selectedCustomer.name}</p>
                      {selectedCustomer.phone && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <i className="ri-phone-line" />
                          {selectedCustomer.phone}
                        </p>
                      )}
                      <p className="text-xs text-amber-600 mt-0.5">
                        {selectedCustomer.visit_count} visita{selectedCustomer.visit_count !== 1 ? 's' : ''}
                        {' · '}${selectedCustomer.total_spent.toFixed(2)} total
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 cursor-pointer transition-colors flex-shrink-0"
                    >
                      <i className="ri-close-line text-gray-600 text-sm" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Mode toggle */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => { setMode('search'); setNameError(''); setPhoneError(''); }}
                      className={`flex-1 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                        mode === 'search' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <i className="ri-search-line mr-1" />
                      Buscar cliente
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMode('new'); setNameError(''); setPhoneError(''); }}
                      className={`flex-1 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                        mode === 'new' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <i className="ri-user-add-line mr-1" />
                      Nuevo cliente
                    </button>
                  </div>

                  {/* SEARCH mode */}
                  {mode === 'search' && (
                    <div>
                      <div className="relative">
                        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                        <input
                          type="text"
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder="Busca por nombre o celular..."
                          autoFocus
                          className="w-full pl-8 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                        />
                        {search && (
                          <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-300 hover:bg-gray-400 cursor-pointer"
                          >
                            <i className="ri-close-line text-white text-xs" />
                          </button>
                        )}
                      </div>

                      <div className="mt-2 max-h-44 overflow-y-auto space-y-1">
                        {searching && (
                          <div className="flex items-center justify-center py-3">
                            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        {!searching && displayResults.length === 0 && search.trim() && (
                          <div className="text-center py-3">
                            <p className="text-xs text-gray-400">Sin resultados para &quot;{search}&quot;</p>
                            <button
                              type="button"
                              onClick={() => { setMode('new'); setName(search); setSearch(''); setNameError(''); setPhoneError(''); }}
                              className="mt-1.5 text-xs text-amber-600 hover:text-amber-700 font-semibold cursor-pointer"
                            >
                              <i className="ri-user-add-line mr-1" />
                              Registrar como nuevo
                            </button>
                          </div>
                        )}
                        {!searching && displayResults.length > 0 && (
                          <>
                            {showingRecent && <p className="text-xs text-gray-400 px-1 mb-1">Recientes</p>}
                            {displayResults.map(cust => {
                              const wasToday = cust.last_visit && new Date(cust.last_visit) >= todayStart;
                              return (
                                <button
                                  key={cust.id}
                                  type="button"
                                  onClick={() => handleSelectCustomer(cust)}
                                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-amber-50 cursor-pointer transition-colors text-left"
                                >
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${wasToday ? 'bg-amber-500' : 'bg-gray-200'}`}>
                                    <span className={`font-bold text-sm ${wasToday ? 'text-white' : 'text-gray-500'}`}>
                                      {cust.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{cust.name}</p>
                                    <p className="text-xs text-gray-400 truncate">
                                      {cust.phone && <span className="mr-2">{cust.phone}</span>}
                                      {wasToday && <span className="text-amber-500 font-medium">· Hoy</span>}
                                    </p>
                                  </div>
                                  <i className="ri-arrow-right-s-line text-gray-300 flex-shrink-0" />
                                </button>
                              );
                            })}
                          </>
                        )}
                        {!searching && displayResults.length === 0 && !search.trim() && (
                          <div className="text-center py-3">
                            <i className="ri-user-search-line text-gray-300 text-2xl" />
                            <p className="text-xs text-gray-400 mt-1">Escribe para buscar un cliente</p>
                            <button
                              type="button"
                              onClick={() => { setMode('new'); setNameError(''); setPhoneError(''); }}
                              className="mt-2 text-xs text-amber-600 hover:text-amber-700 font-semibold cursor-pointer"
                            >
                              <i className="ri-user-add-line mr-1" />
                              Registrar nuevo cliente
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* NEW mode */}
                  {mode === 'new' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Nombre del cliente <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={e => { setName(e.target.value); if (nameError) setNameError(''); }}
                          placeholder="Ej: Edgar Ramírez"
                          autoFocus
                          className={`w-full px-3 py-2.5 bg-gray-50 border rounded-lg text-sm focus:outline-none focus:ring-1 ${
                            nameError
                              ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                              : 'border-gray-200 focus:border-amber-500 focus:ring-amber-500'
                          }`}
                        />
                        {nameError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <i className="ri-error-warning-line" />{nameError}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Celular / WhatsApp <span className="text-red-500">*</span>
                        </label>
                        <div className={`flex items-center gap-2 bg-green-50 border rounded-lg px-3 py-2.5 focus-within:ring-1 ${
                          phoneError
                            ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-400'
                            : 'border-green-200 focus-within:border-green-400 focus-within:ring-green-400'
                        }`}>
                          <i className="ri-whatsapp-line text-green-500 text-base flex-shrink-0" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={e => { setPhone(e.target.value); if (phoneError) setPhoneError(''); }}
                            placeholder="33 1234 5678"
                            className="flex-1 bg-transparent text-sm focus:outline-none"
                          />
                        </div>
                        {phoneError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <i className="ri-error-warning-line" />{phoneError}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-arrow-left-line mr-1" />
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={mode === 'search' && !selectedCustomer}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-store-3-line mr-1" />
                  {selectedCustomer ? 'Abrir Cuenta' : mode === 'new' ? 'Registrar y Abrir' : 'Selecciona un cliente'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 1 footer */}
        {step === 1 && (
          <div className="flex gap-3 px-5 pb-5 pt-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!selectedSpot}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-arrow-right-line mr-1" />
              Siguiente
            </button>
          </div>
        )}

        {/* Step 2 footer */}
        {step === 2 && (
          <div className="flex gap-3 px-5 pb-5 pt-2 flex-shrink-0">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-arrow-left-line mr-1" />
              Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}