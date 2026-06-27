import { useState, useEffect, useCallback, useRef } from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import type { OrderMode } from "../context/CartContext";

interface WelcomeModalProps {
  onDismiss?: () => void;
  forceShow?: boolean;
}

type Step = "choose" | "select-profile" | "dine-in" | "pickup";

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  lastUsed: number;
  favorites?: number[];
}

const CUSTOMER_PROFILES_KEY = 'lc_customer_profiles';
const MAX_PROFILES = 8;

/** Genera ID único simple */
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Migrar viejo formato individual al array de perfiles */
function migrateOldProfile(): CustomerProfile[] {
  try {
    const oldName = localStorage.getItem('lc_customer_name');
    const oldPhone = localStorage.getItem('lc_customer_phone');
    if (oldName) {
      const profile: CustomerProfile = {
        id: genId(),
        name: oldName,
        phone: oldPhone || '',
        lastUsed: Date.now(),
        favorites: [],
      };
      localStorage.setItem(CUSTOMER_PROFILES_KEY, JSON.stringify([profile]));
      // Limpiar viejas claves
      localStorage.removeItem('lc_customer_name');
      localStorage.removeItem('lc_customer_phone');
      return [profile];
    }
  } catch {
    // ignore
  }
  return [];
}

function loadProfiles(): CustomerProfile[] {
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILES_KEY);
    if (!raw) {
      // Intentar migrar desde formato antiguo
      return migrateOldProfile();
    }
    const parsed = JSON.parse(raw) as CustomerProfile[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(p => p.name?.trim())
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, MAX_PROFILES);
  } catch (e) {
    console.warn('[WelcomeModal] getStored failed:', e);
    return [];
  }
}

function saveProfiles(profiles: CustomerProfile[]) {
  try {
    const sorted = profiles
      .filter(p => p.name?.trim())
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, MAX_PROFILES);
    localStorage.setItem(CUSTOMER_PROFILES_KEY, JSON.stringify(sorted));
  } catch {
    // ignore
  }
}

function addProfile(name: string, phone: string, favorites?: number[]): CustomerProfile {
  const profiles = loadProfiles();
  // Si ya existe con mismo nombre, actualizar preservando favoritos
  const existingIdx = profiles.findIndex(p =>
    p.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  let profile: CustomerProfile;
  if (existingIdx >= 0) {
    const existing = profiles[existingIdx];
    profile = {
      ...existing,
      phone: phone.trim(),
      lastUsed: Date.now(),
      favorites: favorites ?? existing.favorites ?? [],
    };
    profiles[existingIdx] = profile;
  } else {
    profile = { id: genId(), name: name.trim(), phone: phone.trim(), lastUsed: Date.now(), favorites: favorites ?? [] };
    profiles.unshift(profile);
  }
  saveProfiles(profiles);
  return profile;
}

function touchProfile(profileId: string) {
  const profiles = loadProfiles();
  const idx = profiles.findIndex(p => p.id === profileId);
  if (idx >= 0) {
    profiles[idx].lastUsed = Date.now();
    saveProfiles(profiles);
  }
}

function deleteProfile(profileId: string) {
  const profiles = loadProfiles().filter(p => p.id !== profileId);
  saveProfiles(profiles);
}

/** Obtener iniciales para avatar */
function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0]?.toUpperCase())
    .slice(0, 2)
    .join('');
}

/** Color determinista por nombre */
function getAvatarColor(name: string): string {
  const colors = [
    'bg-amber-500 text-white',
    'bg-rose-500 text-white',
    'bg-emerald-500 text-white',
    'bg-sky-500 text-white',
    'bg-violet-500 text-white',
    'bg-orange-500 text-white',
    'bg-teal-500 text-white',
    'bg-pink-500 text-white',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function WelcomeModal({ onDismiss, forceShow }: WelcomeModalProps) {
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [profiles, setProfiles] = useState<CustomerProfile[]>(loadProfiles);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState("");
  const [selectedMode, setSelectedMode] = useState<OrderMode | null>(null);
  const [pendingFavorites, setPendingFavorites] = useState<number[] | undefined>(undefined);
  const prevForceShow = useRef(forceShow);

  const { openCartWithMode, setCustomerName, setCustomerPhone, setOrderMode, setTableNumber, setActiveProfileId } = useCart();
  const navigate = useNavigate();

  // Detectar cambios de forceShow para reabrir el modal cuando se fuerza desde el padre
  useEffect(() => {
    if (forceShow && !prevForceShow.current && !visible) {
      setVisible(true);
      setStep("choose");
      setProfiles(loadProfiles);
      requestAnimationFrame(() => setAnimateIn(true));
    }
    prevForceShow.current = forceShow;
  }, [forceShow, visible]);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("lc_welcome_dismissed");
    if (!dismissed || forceShow) {
      setVisible(true);
      requestAnimationFrame(() => setAnimateIn(true));
    }
  }, []);

  const dismiss = useCallback(() => {
    setAnimateIn(false);
    setTimeout(() => setVisible(false), 300);
    sessionStorage.setItem("lc_welcome_dismissed", "true");
    onDismiss?.();
  }, [onDismiss]);

  const proceedWithProfile = useCallback((profile: CustomerProfile) => {
    setCustomerName(profile.name);
    setCustomerPhone(profile.phone);
    setActiveProfileId(profile.id);
    touchProfile(profile.id);
    if (selectedMode === 'dine-in') {
      setTableNumber("");
      setOrderMode("dine-in");
    } else {
      setOrderMode("pickup");
    }
    dismiss();
    setTimeout(() => {
      navigate("/menu");
      setTimeout(() => openCartWithMode(selectedMode!), 300);
    }, 80);
  }, [selectedMode, setCustomerName, setCustomerPhone, setOrderMode, setTableNumber, dismiss, navigate, openCartWithMode, setActiveProfileId]);

  const handleConfirmDineIn = useCallback(() => {
    if (!nombre.trim()) {
      setError("Por favor escribe tu nombre");
      return;
    }
    setError("");
    const profile = addProfile(nombre.trim(), telefono.trim(), pendingFavorites);
    setPendingFavorites(undefined);
    proceedWithProfile(profile);
  }, [nombre, telefono, pendingFavorites, proceedWithProfile]);

  const handleConfirmPickup = useCallback(() => {
    if (!nombre.trim()) {
      setError("Por favor escribe tu nombre");
      return;
    }
    setError("");
    const profile = addProfile(nombre.trim(), telefono.trim(), pendingFavorites);
    setPendingFavorites(undefined);
    proceedWithProfile(profile);
  }, [nombre, telefono, pendingFavorites, proceedWithProfile]);

  const handleJustMenu = useCallback(() => {
    dismiss();
    setTimeout(() => navigate("/menu"), 350);
  }, [dismiss, navigate]);

  const handleChooseMode = (mode: OrderMode) => {
    setSelectedMode(mode);
    if (profiles.length > 0) {
      setStep("select-profile");
    } else {
      setStep(mode === 'dine-in' ? 'dine-in' : 'pickup');
    }
  };

  const handleSelectProfile = (profile: CustomerProfile) => {
    proceedWithProfile(profile);
  };

  const handleDeleteProfile = (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    deleteProfile(profileId);
    setProfiles(loadProfiles());
  };

  const handleAddNewProfile = () => {
    setNombre("");
    setTelefono("");
    setError("");
    setPendingFavorites(undefined);
    setStep(selectedMode === 'dine-in' ? 'dine-in' : 'pickup');
  };

  const handleEditProfile = (profile: CustomerProfile) => {
    setNombre(profile.name);
    setTelefono(profile.phone);
    setError("");
    setPendingFavorites(profile.favorites);
    // Borrar el viejo para reemplazarlo al guardar
    deleteProfile(profile.id);
    setProfiles(loadProfiles());
    setStep(selectedMode === 'dine-in' ? 'dine-in' : 'pickup');
  };

  const resetForm = () => {
    setNombre("");
    setTelefono("");
    setError("");
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          animateIn ? "opacity-100" : "opacity-0"
        }`}
        onClick={dismiss}
      />

      <div
        className={`relative bg-white rounded-2xl w-full max-w-lg overflow-hidden transition-all duration-300 ${
          animateIn ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
        }`}
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="bg-amber-500 px-6 py-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <i className="ri-restaurant-2-line text-white text-2xl" />
            <span className="text-white font-bold text-lg tracking-wide">LA CABRONA</span>
          </div>
          <p className="text-white/90 text-sm font-medium">Alitas &amp; Beer</p>
        </div>

        {/* ── PASO 1: Elegir modo ── */}
        {step === "choose" && (
          <>
            <div className="px-6 pt-6 pb-2 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-1">¡Bienvenidos!</h2>
              <p className="text-gray-500 text-sm">¿Cómo te gustaría disfrutar hoy?</p>
            </div>

            <div className="px-6 space-y-3 pb-4 pt-4">
              <button
                onClick={() => { resetForm(); handleChooseMode("dine-in"); }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-amber-100 hover:border-amber-500 hover:bg-amber-50 transition-all cursor-pointer group text-left"
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500 transition-colors">
                  <i className="ri-restaurant-line text-amber-600 text-xl group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900">Comer Aquí</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Pedís desde tu lugar y te lo llevamos</p>
                </div>
                <i className="ri-arrow-right-s-line text-gray-300 text-xl group-hover:text-amber-500 transition-colors flex-shrink-0" />
              </button>

              <button
                onClick={() => { resetForm(); handleChooseMode("pickup"); }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-amber-100 hover:border-amber-500 hover:bg-amber-50 transition-all cursor-pointer group text-left"
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500 transition-colors">
                  <i className="ri-shopping-bag-3-line text-amber-600 text-xl group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900">Para Recoger</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Hacés tu pedido y pasás a buscarlo</p>
                </div>
                <i className="ri-arrow-right-s-line text-gray-300 text-xl group-hover:text-amber-500 transition-colors flex-shrink-0" />
              </button>

              <button
                onClick={handleJustMenu}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-all cursor-pointer group text-left"
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-400 transition-colors">
                  <i className="ri-menu-search-line text-gray-500 text-xl group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900">Solo Ver Menú</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Navegá el menú completo sin hacer pedido aún</p>
                </div>
                <i className="ri-arrow-right-s-line text-gray-300 text-xl group-hover:text-gray-400 transition-colors flex-shrink-0" />
              </button>
            </div>

            <div className="px-6 pb-5 pt-1 text-center">
              <button
                onClick={dismiss}
                className="text-gray-400 hover:text-gray-600 text-base font-semibold cursor-pointer transition-colors underline underline-offset-2"
              >
                Cerrar y ver la página
              </button>
            </div>
          </>
        )}

        {/* ── PASO 1b: Elegir perfil ── */}
        {step === "select-profile" && (
          <div className="flex flex-col" style={{ maxHeight: 'calc(90vh - 80px)' }}>
            <div className="px-6 pt-5 pb-2 shrink-0">
              <button
                onClick={() => setStep("choose")}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 cursor-pointer mb-4 transition-colors"
              >
                <i className="ri-arrow-left-s-line text-lg" />
                Volver
              </button>

              <div className="text-center mb-4">
                <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <i className="ri-user-smile-line text-amber-600 text-2xl" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">¿Quién ordena?</h2>
                <p className="text-gray-500 text-sm mt-1">Seleccioná tu perfil o agregá uno nuevo</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-2">
              {profiles.map(profile => {
                const initials = getInitials(profile.name);
                const colorClass = getAvatarColor(profile.name);
                return (
                  <button
                    key={profile.id}
                    onClick={() => handleSelectProfile(profile)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all cursor-pointer text-left group"
                  >
                    {/* Avatar */}
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${colorClass}`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{profile.name}</p>
                      {profile.phone && (
                        <p className="text-[11px] text-gray-400">{profile.phone}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditProfile(profile); }}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-amber-600 hover:bg-amber-100 cursor-pointer transition-colors"
                        title="Editar"
                      >
                        <i className="ri-edit-line text-xs" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteProfile(e, profile.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                        title="Eliminar"
                      >
                        <i className="ri-delete-bin-line text-xs" />
                      </button>
                    </div>
                    <i className="ri-arrow-right-s-line text-gray-300 group-hover:text-amber-500 transition-colors flex-shrink-0" />
                  </button>
                );
              })}

              {/* Agregar nuevo perfil */}
              <button
                onClick={handleAddNewProfile}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all cursor-pointer text-left"
              >
                <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <i className="ri-add-line text-gray-500 text-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-700">Agregar perfil nuevo</p>
                  <p className="text-[11px] text-gray-400">Guardá tus datos para pedir más rápido</p>
                </div>
                <i className="ri-arrow-right-s-line text-gray-300 transition-colors flex-shrink-0" />
              </button>
            </div>

            <div className="px-6 pb-5 pt-2 shrink-0 text-center border-t border-gray-100">
              <button
                onClick={dismiss}
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold cursor-pointer transition-colors underline underline-offset-2"
              >
                Cerrar y ver la página
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 2a: Comer aquí — nombre y teléfono ── */}
        {step === "dine-in" && (
          <div className="px-6 py-6">
            <button
              onClick={() => profiles.length > 0 ? setStep("select-profile") : setStep("choose")}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 cursor-pointer mb-5 transition-colors"
            >
              <i className="ri-arrow-left-s-line text-lg" />
              {profiles.length > 0 ? 'Volver a perfiles' : 'Volver'}
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-restaurant-line text-amber-600 text-2xl" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">¿A nombre de quién?</h2>
              <p className="text-gray-500 text-sm mt-1">Para registrar tu pedido y avisarte cuando esté listo</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => { setNombre(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleConfirmDineIn()}
                  placeholder="Ej: Juan Pérez"
                  autoFocus
                  className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Celular / WhatsApp <span className="text-gray-400 font-normal normal-case">(opcional)</span>
                </label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConfirmDineIn()}
                  placeholder="Ej: 33 1234 5678"
                  className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center mt-2 font-medium">
                <i className="ri-error-warning-line mr-1" />{error}
              </p>
            )}

            <button
              onClick={handleConfirmDineIn}
              className="mt-5 w-full bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-xl font-bold text-base cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
            >
              <i className="ri-restaurant-2-line text-lg" />
              Ir al Menú y Ordenar
              <i className="ri-arrow-right-s-line text-lg" />
            </button>

            <button
              onClick={dismiss}
              className="mt-3 w-full text-gray-400 hover:text-gray-600 text-sm font-medium cursor-pointer transition-colors py-1"
            >
              Cerrar y ver la página
            </button>
          </div>
        )}

        {/* ── PASO 2b: Para llevar ── */}
        {step === "pickup" && (
          <div className="px-6 py-6">
            <button
              onClick={() => profiles.length > 0 ? setStep("select-profile") : setStep("choose")}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 cursor-pointer mb-5 transition-colors"
            >
              <i className="ri-arrow-left-s-line text-lg" />
              {profiles.length > 0 ? 'Volver a perfiles' : 'Volver'}
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-shopping-bag-3-line text-amber-600 text-2xl" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">¿A nombre de quién?</h2>
              <p className="text-gray-500 text-sm mt-1">Para avisarte cuando esté listo tu pedido</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => { setNombre(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleConfirmPickup()}
                  placeholder="Ej: Juan Pérez"
                  autoFocus
                  className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Celular / WhatsApp <span className="text-gray-400 font-normal normal-case">(opcional)</span>
                </label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConfirmPickup()}
                  placeholder="Ej: 33 1234 5678"
                  className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center mt-2 font-medium">
                <i className="ri-error-warning-line mr-1" />{error}
              </p>
            )}

            <button
              onClick={handleConfirmPickup}
              className="mt-5 w-full bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-xl font-bold text-base cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
            >
              <i className="ri-restaurant-2-line text-lg" />
              Ir al Menú y Ordenar
              <i className="ri-arrow-right-s-line text-lg" />
            </button>

            <button
              onClick={dismiss}
              className="mt-3 w-full text-gray-400 hover:text-gray-600 text-sm font-medium cursor-pointer transition-colors py-1"
            >
              Cerrar y ver la página
            </button>
          </div>
        )}
      </div>
    </div>
  );
}