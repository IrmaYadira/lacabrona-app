import { useSiteSettings } from '@/hooks/useSiteSettings';

export default function SiteSettingsPanel() {
  const { settings, loading, updateSettings } = useSiteSettings();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <i className="ri-loader-4-line animate-spin text-amber-500 text-2xl" />
        <span className="ml-2 text-gray-500 text-sm font-medium">Cargando configuración...</span>
      </div>
    );
  }

  const handleToggle = async (key: 'share_experience_enabled' | 'google_reviews_enabled' | 'gallery_enabled' | 'events_enabled') => {
    if (!settings) return;
    await updateSettings({ [key]: !settings[key] });
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h2 className="text-xl font-black text-gray-900">Configuración del Sitio</h2>
        <p className="text-gray-500 text-sm mt-1">Activa o desactiva las secciones visibles en la página principal.</p>
      </div>

      <div className="space-y-4">
        {/* Comparte tu experiencia */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${settings?.share_experience_enabled ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
              <i className="ri-share-line text-lg" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Comparte tu experiencia</p>
              <p className="text-gray-500 text-xs">Sección de redes sociales y Google Reviews en el home</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('share_experience_enabled')}
            className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${settings?.share_experience_enabled ? 'bg-amber-500' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${settings?.share_experience_enabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>

        {/* Google Reviews en general */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${settings?.google_reviews_enabled ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
              <i className="ri-google-fill text-lg" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Botones de Google Reviews</p>
              <p className="text-gray-500 text-xs">Links a Google Reviews en el home y en el menú</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('google_reviews_enabled')}
            className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${settings?.google_reviews_enabled ? 'bg-amber-500' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${settings?.google_reviews_enabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>

        {/* Galería */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${settings?.gallery_enabled ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
              <i className="ri-image-line text-lg" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Galería de Fotos</p>
              <p className="text-gray-500 text-xs">Sección de galería con fotos del bar en el home</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('gallery_enabled')}
            className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${settings?.gallery_enabled ? 'bg-amber-500' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${settings?.gallery_enabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>

        {/* Eventos */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${settings?.events_enabled ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
              <i className="ri-calendar-event-line text-lg" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Eventos Especiales</p>
              <p className="text-gray-500 text-xs">Sección de eventos y promociones en el home</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('events_enabled')}
            className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${settings?.events_enabled ? 'bg-amber-500' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${settings?.events_enabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <i className="ri-information-line text-amber-600 text-lg flex-shrink-0 mt-0.5" />
        <p className="text-amber-700 text-xs leading-relaxed">
          Los cambios se aplican inmediatamente en la página principal. Los usuarios que ya tengan cargada la página verán el cambio al recargar o al navegar de nuevo al inicio.
        </p>
      </div>
    </div>
  );
}