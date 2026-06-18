import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  es: {
    translation: {
      nav: {
        menu: 'Menú',
        combos: 'Combos',
        cervezas: 'Cervezas',
        alitas: 'Alitas',
        contacto: 'Contacto',
        horario: 'Horario',
        ubicacion: 'Ubicación',
      },
      hero: {
        title: 'La Cabrona',
        subtitle: 'Alitas & Beer',
        cta: 'Ver Menú',
        order: 'Pedir por WhatsApp',
      },
      footer: {
        rights: 'Todos los derechos reservados',
      },
    },
  },
  en: {
    translation: {
      nav: {
        menu: 'Menu',
        combos: 'Combos',
        cervezas: 'Beer',
        alitas: 'Wings',
        contacto: 'Contact',
        horario: 'Hours',
        ubicacion: 'Location',
      },
      hero: {
        title: 'La Cabrona',
        subtitle: 'Wings & Beer',
        cta: 'View Menu',
        order: 'Order via WhatsApp',
      },
      footer: {
        rights: 'All rights reserved',
      },
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: 'es',
    fallbackLng: 'es',
    debug: false,
    resources,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;