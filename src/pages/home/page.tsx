import { Suspense, lazy, useMemo, useCallback, useEffect } from "react";
import Navbar from "./components/Navbar";
import HeroSection from "./components/HeroSection";
import WelcomeModal from "./components/WelcomeModal";
import FavoriteToast from "./components/FavoriteToast";
import CartRemoveToast from "./components/CartRemoveToast";
import LazySection from "@/components/base/LazySection";
import SeoTextSection from "./components/SeoTextSection";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PausedProvider } from "./context/PausedContext";
import { useCart } from "./context/CartContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import JsonLd from "@/components/JsonLd";

const HOME_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["BarOrPub", "FoodEstablishment", "LocalBusiness"],
      "@id": "https://barlacabrona.com/#business",
      "name": "La Cabrona Alitas & Beer",
      "alternateName": "La Cabrona Bar Zapopan",
      "description": "Bar especializado en alitas de pollo crujientes y cerveza fria en Zapopan, Jalisco. Las mejores alitas en El Mante Zapopan. Boneless, preparados, micheladas, cervezas nacionales e importadas. Ambiente familiar y deportivo.",
      "url": "https://barlacabrona.com/",
      "telephone": "+52-33-4856-7795",
      "email": "lacabrona2016@hotmail.com",
      "image": "https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285",
      "logo": {
        "@type": "ImageObject",
        "url": "https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285"
      },
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Calle Sinaloa 690",
        "addressLocality": "Zapopan",
        "addressRegion": "Jalisco",
        "postalCode": "45235",
        "addressCountry": "MX"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 20.6111,
        "longitude": -103.4214
      },
      "hasMap": "https://maps.google.com/?q=La+Cabrona+Alitas+Beer+Sinaloa+690+El+Mante+Zapopan",
      "openingHoursSpecification": [
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday"],
          "opens": "13:00",
          "closes": "00:00",
          "description": "Lunes a jueves: horario regular con servicio completo de cocina y barra. Cocina abierta hasta las 23:30 hrs. Happy Hour de 17:00 a 19:00 hrs en cerveza de barril."
        },
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Friday", "Saturday"],
          "opens": "14:00",
          "closes": "02:00",
          "description": "Viernes y sabado: ambiente de fin de semana con transmisiones deportivas en pantalla gigante. Cocina abierta hasta las 01:30 hrs. Promociones especiales en cubetas y alitas."
        },
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": "Sunday",
          "opens": "14:00",
          "closes": "23:00",
          "description": "Domingo: plan tranquilo para la cruda o el calor. Clamato especial de 2 litros a $180. Cocina abierta hasta las 22:30 hrs. Transmision de partidos estelares."
        }
      ],
      "sameAs": [
        "https://www.facebook.com/barlacabrona/",
        "https://www.instagram.com/lacabronabar/"
      ],
      "servesCuisine": [
        "Alitas de pollo",
        "Boneless",
        "Hamburguesas artesanales",
        "Hot Dogs",
        "Botanas mexicanas",
        "Cerveza nacional e importada",
        "Micheladas",
        "Preparados y cocteles",
        "Clamato",
        "Alitas BBQ",
        "Alitas Buffalo",
        "Comida rapida mexicana",
        "Antojitos"
      ],
      "priceRange": "$$",
      "currenciesAccepted": "MXN",
      "paymentAccepted": "Efectivo, Tarjeta de credito, Tarjeta de debito, Transferencia",
      "menu": "https://barlacabrona.com/menu",
      "hasMenu": {
        "@type": "Menu",
        "name": "Menu Completo La Cabrona",
        "description": "Menu completo de alitas, boneless, hamburguesas, hot dogs, micheladas, cervezas, preparados y cocteles en La Cabrona Bar Zapopan",
        "url": "https://barlacabrona.com/menu"
      },
      "areaServed": [
        { "@type": "City", "name": "Zapopan" },
        { "@type": "City", "name": "Guadalajara" },
        { "@type": "Place", "name": "El Mante" },
        { "@type": "Place", "name": "Colonia Seattle" },
        { "@type": "Place", "name": "Lomas de Zapopan" }
      ],
      "amenityFeature": [
        { "@type": "LocationFeatureSpecification", "name": "Estacionamiento amplio", "value": true },
        { "@type": "LocationFeatureSpecification", "name": "Pantallas deportivas gigantes", "value": true },
        { "@type": "LocationFeatureSpecification", "name": "Pedidos por WhatsApp", "value": true },
        { "@type": "LocationFeatureSpecification", "name": "Mesas de billar profesionales", "value": true },
        { "@type": "LocationFeatureSpecification", "name": "Transmision Mundial 2026", "value": true },
        { "@type": "LocationFeatureSpecification", "name": "Happy Hour lunes a jueves", "value": true },
        { "@type": "LocationFeatureSpecification", "name": "Reservaciones en linea", "value": true },
        { "@type": "LocationFeatureSpecification", "name": "WiFi gratuito", "value": true }
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+52-33-4856-7795",
        "contactType": "customer service",
        "availableLanguage": "Spanish",
        "areaServed": ["Zapopan", "Guadalajara", "Jalisco"]
      },
      "smokingAllowed": false,
      "keywords": "bar, alitas, cerveza, boneless, hamburguesas, micheladas, preparados, billar, mundial 2026, futbol en vivo, zapopan, el mante, jalisco"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://barlacabrona.com/" }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "Donde esta La Cabrona Alitas y Beer?", "acceptedAnswer": { "@type": "Answer", "text": "Estamos en Calle Sinaloa 690, Colonia El Mante, Zapopan, Jalisco, Mexico. Facil acceso desde Av. Patria." } },
        { "@type": "Question", "name": "Cuales son los horarios de La Cabrona?", "acceptedAnswer": { "@type": "Answer", "text": "Lunes a jueves de 13:00 a 00:00 hrs. Viernes y sabado de 14:00 a 02:00 hrs. Domingo de 14:00 a 23:00 hrs." } },
        { "@type": "Question", "name": "Como hacer un pedido en La Cabrona?", "acceptedAnswer": { "@type": "Answer", "text": "Puedes ordenar directamente en el bar con los meseros, hacer tu pedido por WhatsApp al 33-4856-7795, o usar nuestro menu digital desde la pagina web. Tambien ofrecemos servicio a domicilio en Zapopan." } },
        { "@type": "Question", "name": "Tienen mesas de billar en La Cabrona?", "acceptedAnswer": { "@type": "Answer", "text": "Si, contamos con 2 mesas de billar profesionales. Tarifas desde $40 la media hora, $70 la hora. Se requiere INE vigente para rentar. Maximo 6 personas por mesa." } },
        { "@type": "Question", "name": "Cuantos sabores de alitas tienen en La Cabrona?", "acceptedAnswer": { "@type": "Answer", "text": "Contamos con 12 sabores diferentes: BBQ, BBQ Ahumada, BBQ Diabla, Mango Habanero, Buffalo, Bufalo Ranch, Cajun, Habanero, Chipotle, Tamarindo Hot, Lemon & Pepper y Maracuya Habanero. Disponibles en alitas y boneless." } },
        { "@type": "Question", "name": "Aceptan tarjeta de credito en La Cabrona?", "acceptedAnswer": { "@type": "Answer", "text": "Si, aceptamos efectivo, tarjeta de credito, tarjeta de debito y transferencias bancarias. El pago es seguro y rapido." } },
        { "@type": "Question", "name": "Se pueden hacer reservaciones en La Cabrona?", "acceptedAnswer": { "@type": "Answer", "text": "Si, puedes reservar tu mesa a traves de nuestra pagina web en barlacabrona.com/reservas o enviandonos un mensaje por WhatsApp al 33-4856-7795. Recomendamos reservar con anticipacion los fines de semana." } },
        { "@type": "Question", "name": "La Cabrona tiene estacionamiento?", "acceptedAnswer": { "@type": "Answer", "text": "Contamos con zona de estacionamiento amplia y segura cercana al bar, con facil acceso desde Avenida Patria en Zapopan, Jalisco." } },
        { "@type": "Question", "name": "Tienen servicio a domicilio en Zapopan?", "acceptedAnswer": { "@type": "Answer", "text": "Si, puedes hacer tu pedido por WhatsApp al 33-4856-7795 y coordinar la entrega a domicilio en Zapopan y zonas aledanas. Tambien puedes ordenar para llevar directamente en el local." } }
      ]
    },
    {
      "@type": "AggregateRating",
      "itemReviewed": { "@id": "https://barlacabrona.com/#business" },
      "ratingValue": "4.7",
      "bestRating": "5",
      "ratingCount": "186",
      "reviewCount": "186"
    },
    {
      "@type": "Event",
      "name": "Domingo de Clamato Especial 2 Litros $180 en La Cabrona Zapopan",
      "description": "Clamato preparado gigante de 2 litros para compartir a precio especial. Ideal para la cruda o para empezar el domingo relax en La Cabrona Zapopan, Jalisco.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Refreshing%20Mexican%20clamato%20cocktail%20in%20a%20large%20chilled%20beer%20mug%20garnished%20with%20lime%20shrimp%20and%20tajin%20rim%20on%20a%20rustic%20wooden%20bar%20table%20soft%20afternoon%20sunlight%20streaming%20through%20windows%20casual%20cantina%20atmosphere%20warm%20amber%20tones%20editorial%20drink%20photography&width=1200&height=630&seq=evento-clamato-domingo-v2&orientation=landscape",
      "startDate": "2026-06-14T13:00-06:00",
      "endDate": "2026-06-14T20:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "offers": { "@type": "Offer", "price": 180, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-14T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Promo Tarros Claros 1L 2x$100 en La Cabrona - Domingo de Mundial",
      "description": "Tarros claros de cerveza de 1 litro bien frios. Llevate 2 por solo $100 pesos. La promo perfecta para acompanar los partidos del Mundial 2026 con toda la banda en La Cabrona Zapopan.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Two%20large%20chilled%20clear%20glass%20beer%20mugs%20filled%20with%20golden%20lager%20beer%20condensation%20dripping%20down%20the%20sides%20placed%20on%20a%20dark%20rustic%20wooden%20table%20in%20a%20lively%20Mexican%20sports%20bar%20with%20warm%20amber%20pendant%20lighting%20football%20scarves%20draped%20nearby%20authentic%20cantina%20atmosphere%20editorial%20drink%20photography%20sharp%20focus&width=1200&height=630&seq=evento-tarros-claros-1l&orientation=landscape",
      "startDate": "2026-06-14T13:00-06:00",
      "endDate": "2026-06-14T23:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "offers": { "@type": "Offer", "price": 100, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-14T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Paises Bajos vs Japon - Transmision Mundial 2026 en La Cabrona",
      "description": "Choque de estilos europeo vs asiatico. Naranja mecanica contra los samurais azules. Vive la emocion del Mundial 2026 con promo en cerveza de barril y las mejores alitas de Zapopan.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Dutch%20and%20Japanese%20football%20fans%20celebrating%20together%20in%20a%20lively%20sports%20bar%20World%20Cup%202026%20orange%20and%20blue%20colors%20in%20the%20crowd%20large%20screens%20showing%20Netherlands%20vs%20Japan%20match%20cold%20draft%20beer%20and%20chicken%20wings%20on%20wooden%20tables%20festive%20atmosphere%20editorial%20photography%20warm%20lighting&width=1200&height=630&seq=evento-paisesbajos-japon-v2&orientation=landscape",
      "startDate": "2026-06-14T14:00-06:00",
      "endDate": "2026-06-14T16:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Paises Bajos vs Japon" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Costa de Marfil vs Ecuador - Transmision Mundial 2026 en La Cabrona",
      "description": "Duelo africano-sudamericano con mucho talento en la cancha. Disfrutalo en nuestras pantallas gigantes con cubetas en promocion y el mejor ambiente en Zapopan, Jalisco.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=African%20and%20South%20American%20football%20fans%20cheering%20intensely%20in%20a%20packed%20sports%20bar%20World%20Cup%202026%20big%20screen%20showing%20Ivory%20Coast%20vs%20Ecuador%20vibrant%20flags%20colorful%20jerseys%20cold%20beer%20bottles%20and%20snacks%20on%20tables%20editorial%20sports%20photography%20warm%20amber%20lighting&width=1200&height=630&seq=evento-costa-marfil-ecuador-v2&orientation=landscape",
      "startDate": "2026-06-14T17:00-06:00",
      "endDate": "2026-06-14T19:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Costa de Marfil vs Ecuador" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Suecia vs Tunez EN VIVO desde el Estadio Guadalajara - Mundial 2026",
      "description": "Partido EN VIVO desde el Estadio Guadalajara! La sede del torneo esta a unos minutos de La Cabrona. Este es EL partido del fin de semana en Zapopan.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Swedish%20and%20Tunisian%20football%20fans%20celebrating%20World%20Cup%202026%20match%20live%20from%20Estadio%20Guadalajara%20in%20a%20busy%20sports%20bar%20large%20screens%20showing%20the%20stadium%20crowd%20cold%20beer%20and%20wings%20festive%20Latin%20American%20atmosphere%20Mexican%20flags%20and%20football%20scarves%20editorial%20photography%20warm%20golden%20lighting&width=1200&height=630&seq=evento-suecia-tunez-guadalajara-v2&orientation=landscape",
      "startDate": "2026-06-14T18:00-06:00",
      "endDate": "2026-06-14T20:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Suecia vs Tunez" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Espana vs Cabo Verde - Transmision Mundial 2026 en La Cabrona",
      "description": "La Roja debuta contra Cabo Verde en Atlanta. Ven a ver el debut espanol en nuestras pantallas gigantes con las mejores alitas y cerveza fria en Zapopan.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Spanish%20football%20fans%20in%20red%20jerseys%20celebrating%20passionately%20in%20a%20lively%20sports%20bar%20World%20Cup%202026%20Spain%20vs%20Cape%20Verde%20on%20large%20screens%20cold%20beer%20pitchers%20and%20tapas%20style%20snacks%20on%20wooden%20tables%20energetic%20Mediterranean%20atmosphere%20warm%20golden%20lighting%20editorial%20sports%20photography&width=1200&height=630&seq=evento-espana-cabo-verde&orientation=landscape",
      "startDate": "2026-06-15T11:00-06:00",
      "endDate": "2026-06-15T13:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Espana vs Cabo Verde" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Belgica vs Egipto - Transmision Mundial 2026 en La Cabrona",
      "description": "Los Diablos Rojos frente a los Faraones en Seattle. Duelo de poder europeo contra la garra africana. De Bruyne y Lukaku contra Salah. Ven a vivir este partidazo.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Belgian%20and%20Egyptian%20football%20fans%20cheering%20together%20in%20a%20vibrant%20sports%20bar%20World%20Cup%202026%20red%20and%20pharaoh%20themed%20colors%20in%20the%20crowd%20large%20screens%20showing%20Belgium%20vs%20Egypt%20match%20cold%20beer%20buckets%20on%20tables%20festive%20energetic%20atmosphere%20editorial%20photography%20warm%20lighting&width=1200&height=630&seq=evento-belgica-egipto&orientation=landscape",
      "startDate": "2026-06-15T17:00-06:00",
      "endDate": "2026-06-15T19:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Belgica vs Egipto" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Arabia Saudita vs Uruguay - Transmision Mundial 2026 en La Cabrona",
      "description": "La Celeste charrua contra los Halcones Verdes en Miami. Uruguay quiere demostrar por que es candidato serio al titulo con Valverde y Darwin Nunez.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Uruguayan%20and%20Saudi%20Arabian%20football%20fans%20watching%20an%20intense%20World%20Cup%202026%20match%20in%20a%20packed%20sports%20bar%20sky%20blue%20flags%20and%20green%20banners%20large%20screens%20showing%20the%20game%20cold%20beer%20and%20empanadas%20on%20wooden%20tables%20passionate%20crowd%20reactions%20warm%20amber%20lighting%20editorial%20photography&width=1200&height=630&seq=evento-arabia-uruguay&orientation=landscape",
      "startDate": "2026-06-15T17:00-06:00",
      "endDate": "2026-06-15T19:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Arabia Saudita vs Uruguay" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Iran vs Nueva Zelanda - Transmision Mundial 2026 en La Cabrona",
      "description": "Choque asiatico-oceanico en Los Angeles. Iran busca su primera victoria mundialista ante unos Kiwis aguerridos que nunca se rinden.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Iranian%20and%20New%20Zealand%20football%20fans%20watching%20a%20late%20night%20World%20Cup%202026%20match%20in%20a%20dimly%20lit%20sports%20bar%20with%20warm%20amber%20pendant%20lights%20large%20screens%20glowing%20cold%20beer%20and%20snacks%20scattered%20on%20tables%20intense%20focused%20atmosphere%20all%20black%20and%20persian%20flags%20visible%20editorial%20photography&width=1200&height=630&seq=evento-iran-nueva-zelanda&orientation=landscape",
      "startDate": "2026-06-15T23:00-06:00",
      "endDate": "2026-06-16T01:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Iran vs Nueva Zelanda" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Francia vs Senegal - Transmision Mundial 2026 en La Cabrona",
      "description": "La campeona defensora Francia se mide a Senegal en Nueva York. Mbappe y compania contra los Leones de Teranga en un duelo que promete goles.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=French%20and%20Senegalese%20football%20fans%20celebrating%20together%20in%20a%20packed%20sports%20bar%20World%20Cup%202026%20France%20vs%20Senegal%20on%20multiple%20large%20screens%20tricolor%20flags%20and%20green%20yellow%20red%20banners%20cold%20beer%20pitchers%20and%20chicken%20wings%20on%20wooden%20tables%20high%20energy%20atmosphere%20editorial%20photography%20warm%20lighting&width=1200&height=630&seq=evento-francia-senegal&orientation=landscape",
      "startDate": "2026-06-16T14:00-06:00",
      "endDate": "2026-06-16T16:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Francia vs Senegal" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Irak vs Noruega - Transmision Mundial 2026 en La Cabrona",
      "description": "Los Leones de Mesopotamia contra los Vikingos en Boston. Haaland quiere devorar la defensa iraqui y demostrar por que es el mejor delantero del mundo.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Norwegian%20and%20Iraqi%20football%20fans%20watching%20an%20exciting%20World%20Cup%202026%20match%20in%20a%20lively%20sports%20bar%20red%20blue%20Scandinavian%20flags%20mixed%20with%20Iraqi%20banners%20large%20screens%20showing%20Haaland%20in%20action%20cold%20beer%20on%20wooden%20tables%20intense%20atmosphere%20editorial%20photography%20warm%20golden%20light&width=1200&height=630&seq=evento-irak-noruega&orientation=landscape",
      "startDate": "2026-06-16T17:00-06:00",
      "endDate": "2026-06-16T19:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Irak vs Noruega" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Argentina vs Argelia - Transmision Mundial 2026 en La Cabrona",
      "description": "La Albiceleste de Messi debuta en Kansas City. Argentina es la gran favorita y quiere empezar con goleada para marcar territorio. El evento imperdible del martes.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Argentine%20football%20fans%20going%20wild%20in%20a%20packed%20sports%20bar%20World%20Cup%202026%20Messi%20on%20the%20large%20screens%20celeste%20and%20white%20flags%20everywhere%20cold%20Quilmes%20beer%20and%20empanadas%20on%20tables%20passionate%20cheering%20crowd%20tears%20of%20joy%20atmosphere%20editorial%20photography%20warm%20golden%20lighting&width=1200&height=630&seq=evento-argentina-argelia&orientation=landscape",
      "startDate": "2026-06-16T20:00-06:00",
      "endDate": "2026-06-16T22:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Argentina vs Argelia" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Austria vs Jordania - Transmision Mundial 2026 en La Cabrona",
      "description": "Duelo europeo-asiatico en San Francisco. Austria quiere imponer su orden tactico y fisico ante una Jordania valiente que debuta en un Mundial.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Austrian%20and%20Jordanian%20football%20fans%20watching%20a%20late%20night%20World%20Cup%202026%20match%20in%20a%20cozy%20dimly%20lit%20sports%20bar%20with%20warm%20lighting%20large%20screens%20red%20white%20flags%20mixed%20with%20Middle%20Eastern%20banners%20cold%20beer%20glasses%20on%20tables%20relaxed%20but%20focused%20atmosphere%20editorial%20photography&width=1200&height=630&seq=evento-austria-jordania&orientation=landscape",
      "startDate": "2026-06-16T23:00-06:00",
      "endDate": "2026-06-17T01:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Austria vs Jordania" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Portugal vs RD Congo - Transmision Mundial 2026 en La Cabrona",
      "description": "CR7 y Portugal abren contra el Congo en Houston. Los lusos son serios candidatos al titulo y Cristiano quiere despedirse del Mundial con gloria.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Portuguese%20football%20fans%20in%20red%20and%20green%20jerseys%20cheering%20enthusiastically%20in%20a%20sports%20bar%20World%20Cup%202026%20Cristiano%20Ronaldo%20on%20large%20screens%20flags%20and%20scarves%20everywhere%20cold%20Super%20Bock%20beer%20on%20wooden%20tables%20passionate%20atmosphere%20warm%20natural%20lighting%20editorial%20photography&width=1200&height=630&seq=evento-portugal-rdcongo&orientation=landscape",
      "startDate": "2026-06-17T11:00-06:00",
      "endDate": "2026-06-17T13:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Portugal vs RD Congo" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Inglaterra vs Croacia - Transmision Mundial 2026 en La Cabrona",
      "description": "Los inventores del futbol contra los subcampeones de 2018 en Dallas. Partidazo de alto voltaje tactico entre Bellingham y Modric. Promo especial en cerveza de barril.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=English%20and%20Croatian%20football%20fans%20in%20a%20packed%20sports%20bar%20World%20Cup%202026%20England%20vs%20Croatia%20on%20large%20screens%20St%20George%20crosses%20and%20checkered%20red%20white%20flags%20cold%20pints%20of%20beer%20on%20wooden%20tables%20intense%20match%20atmosphere%20crowd%20reactions%20editorial%20photography%20warm%20golden%20lighting&width=1200&height=630&seq=evento-inglaterra-croacia&orientation=landscape",
      "startDate": "2026-06-17T14:00-06:00",
      "endDate": "2026-06-17T16:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Inglaterra vs Croacia" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Ghana vs Panama - Transmision Mundial 2026 en La Cabrona",
      "description": "Las Estrellas Negras contra los Canaleros en Toronto. Dos equipos con hambre de hacer historia en el grupo L. Disfrutalo con cubetas en promo.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Ghanaian%20and%20Panamanian%20football%20fans%20cheering%20together%20in%20a%20lively%20sports%20bar%20World%20Cup%202026%20black%20star%20flags%20and%20red%20white%20blue%20banners%20large%20screens%20showing%20the%20match%20cold%20beer%20and%20spicy%20snacks%20on%20tables%20festive%20multicultural%20atmosphere%20editorial%20photography%20warm%20amber%20light&width=1200&height=630&seq=evento-ghana-panama&orientation=landscape",
      "startDate": "2026-06-17T17:00-06:00",
      "endDate": "2026-06-17T19:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Ghana vs Panama" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Uzbekistan vs Colombia - Transmision Mundial 2026 en La Cabrona",
      "description": "Los cafeteros debutan en el Azteca contra Uzbekistan. Colombia suena en grande con Luis Diaz liderando el ataque. Miercoles de pasion cafetera.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Colombian%20football%20fans%20going%20absolutely%20wild%20in%20a%20packed%20sports%20bar%20World%20Cup%202026%20yellow%20jerseys%20everywhere%20large%20screens%20showing%20Colombia%20vs%20Uzbekistan%20match%20cold%20Aguila%20beer%20on%20tables%20passionate%20celebration%20atmosphere%20confetti%20and%20flags%20editorial%20photography%20warm%20vibrant%20lighting&width=1200&height=630&seq=evento-uzbekistan-colombia&orientation=landscape",
      "startDate": "2026-06-17T20:00-06:00",
      "endDate": "2026-06-17T22:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Uzbekistan vs Colombia" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    },
    {
      "@type": "Event",
      "name": "Republica Checa vs Sudafrica - Transmision Mundial 2026 en La Cabrona",
      "description": "Duelo europeo-africano en Atlanta. Los checos quieren imponer su fisico ante la velocidad sudafricana. Jueves de futbol matutino en La Cabrona.",
      "url": "https://barlacabrona.com/",
      "image": "https://readdy.ai/api/search-image?query=Czech%20and%20South%20African%20football%20fans%20enjoying%20a%20morning%20World%20Cup%202026%20match%20in%20a%20bright%20sports%20bar%20with%20natural%20light%20streaming%20in%20large%20screens%20showing%20the%20game%20red%20white%20blue%20flags%20mixed%20with%20rainbow%20nation%20banners%20cold%20beer%20and%20breakfast%20snacks%20editorial%20photography%20clean%20warm%20atmosphere&width=1200&height=630&seq=evento-repcheca-sudafrica&orientation=landscape",
      "startDate": "2026-06-18T11:00-06:00",
      "endDate": "2026-06-18T13:00-06:00",
      "location": { "@id": "https://barlacabrona.com/#business" },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": { "@id": "https://barlacabrona.com/#business" },
      "performer": { "@type": "SportsTeam", "name": "Republica Checa vs Sudafrica" },
      "offers": { "@type": "Offer", "price": 0, "priceCurrency": "MXN", "availability": "https://schema.org/InStock", "validFrom": "2026-06-10T00:00-06:00", "url": "https://barlacabrona.com/" }
    }
  ]
};

// Lazy-load de secciones below-the-fold para reducir bundle inicial y mejorar LCP
const EventosSection = lazy(() => import("./components/EventosSection"));
const GallerySection = lazy(() => import("./components/GallerySection"));
const ShareExperienceSection = lazy(() => import("./components/ShareExperienceSection"));
const SidesSection = lazy(() => import("./components/SidesSection"));
const MenuSection = lazy(() => import("./components/MenuSection"));
const BonelessSection = lazy(() => import("./components/BonelessSection"));
const BurgersSection = lazy(() => import("./components/BurgersSection"));
const HotDogsSection = lazy(() => import("./components/HotDogsSection"));
const CombosSection = lazy(() => import("./components/CombosSection"));
const MicheladaSection = lazy(() => import("./components/MicheladaSection"));
const BarrilSection = lazy(() => import("./components/BarrilSection"));
const BeerSection = lazy(() => import("./components/BeerSection"));
const PacificoBeersSection = lazy(() => import("./components/PacificoBeersSection"));
const HalfBeersSection = lazy(() => import("./components/HalfBeersSection"));
const AmpolletasSection = lazy(() => import("./components/AmpolletasSection"));
const CaguamasSection = lazy(() => import("./components/CaguamasSection"));
const NonAlcoholicBeersSection = lazy(() => import("./components/NonAlcoholicBeersSection"));
const VasosPreparadosSection = lazy(() => import("./components/VasosPreparadosSection"));
const ShotShowsSection = lazy(() => import("./components/ShotShowsSection"));
const PreparadosSection = lazy(() => import("./components/PreparadosSection"));
const AzulitosSection = lazy(() => import("./components/AzulitosSection"));
const CannedAlcoholicSection = lazy(() => import("./components/CannedAlcoholicSection"));
const BebidasSinAlcoholSection = lazy(() => import("./components/BebidasSinAlcoholSection"));
const CigarrettesSection = lazy(() => import("./components/CigarrettesSection"));
const MisReservacionesSection = lazy(() => import("./components/MisReservacionesSection"));
const HoursSection = lazy(() => import("./components/HoursSection"));
const LocationSection = lazy(() => import("./components/LocationSection"));
const Footer = lazy(() => import("./components/Footer"));

// Lazy-load de componentes no críticos para LCP
const MenuSearchBar = lazy(() => import("./components/MenuSearchBar"));
const FavoritesSection = lazy(() => import("./components/FavoritesSection"));
const LoyaltyModal = lazy(() => import("./components/LoyaltyModal"));
const LoyaltyReminder = lazy(() => import("./components/LoyaltyReminder"));
const WhatsAppFloat = lazy(() => import("./components/WhatsAppFloat"));

const LOGO_URL = "https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285";

const LOYALTY_SESSION_KEY = 'lc_loyalty_shown';

export default function Home() {
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => {
    return sessionStorage.getItem("lc_welcome_dismissed") === "true";
  });
  const [showWelcome, setShowWelcome] = useState(false);
  const [showLoyalty, setShowLoyalty] = useState(() => {
    const shownThisSession = sessionStorage.getItem(LOYALTY_SESSION_KEY) === 'true';
    if (shownThisSession) return false;
    return true;
  });
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showReservations, setShowReservations] = useState(false);
  const [reservationsHighlight, setReservationsHighlight] = useState(false);

  const { settings } = useSiteSettings();

  // Prefetch del bundle de /menu en segundo plano para que cargue instantáneo al hacer clic
  useEffect(() => {
    const timer = setTimeout(() => {
      // Trigger lazy import para que Vite descargue el chunk de /menu en background
      import("../menu/page").catch(() => {
        // Silencio: si falla el prefetch, no afecta la experiencia del usuario
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Diferir WhatsAppFloat hasta después del LCP para no competir con recursos críticos
  useEffect(() => {
    const timer = setTimeout(() => setShowWhatsApp(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleWelcomeDismiss = () => {
    setWelcomeDismissed(true);
    setShowWelcome(false);
  };

  const handleLoyaltyDismiss = () => {
    sessionStorage.setItem(LOYALTY_SESSION_KEY, 'true');
    setShowLoyalty(false);
  };

  const handleOrderNow = useCallback(() => {
    sessionStorage.removeItem("lc_welcome_dismissed");
    setShowWelcome(true);
  }, []);

  const handleOpenLoyalty = useCallback(() => {
    sessionStorage.removeItem(LOYALTY_SESSION_KEY);
    setShowLoyalty(true);
  }, []);

  const handleOpenReservations = useCallback(() => {
    setReservationsHighlight(false);
    setShowReservations(true);
    // Esperar dos frames para que React monte la sección, luego hacer scroll
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById('mis-reservaciones');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          // Activar el highlight dorado justo cuando termina el scroll (~700ms)
          setTimeout(() => setReservationsHighlight(true), 700);
        }
      });
    });
  }, []);

  const { itemCount, total, setIsOpen, favorites } = useCart();

  const showShareExperience = settings?.share_experience_enabled !== false;
  const hasFavorites = favorites.length > 0;

  // Memoizar botón flotante del carrito para evitar re-creación en cada render
  const cartButton = useMemo(() => {
    if (itemCount === 0) return null;
    return (
      <div className="fixed bottom-24 right-5 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-3 bg-gray-900 hover:bg-gray-800 active:scale-95 text-white px-5 py-3.5 rounded-2xl cursor-pointer transition-all"
        >
          <div className="relative">
            <i className="ri-shopping-basket-2-line text-xl text-amber-400" />
            <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {itemCount}
            </span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs font-bold leading-tight">{itemCount} {itemCount === 1 ? 'producto' : 'productos'}</span>
            <span className="text-sm font-black text-amber-400 leading-tight">${Number(total).toFixed(2)}</span>
          </div>
          <i className="ri-arrow-right-s-line text-white/60 text-lg" />
        </button>
      </div>
    );
  }, [itemCount, total, setIsOpen]);

  return (
    <PausedProvider>
    <div className="min-h-screen bg-white overflow-x-hidden">
      <JsonLd data={HOME_JSONLD} />
      <Navbar logoUrl={LOGO_URL} onOrderNow={handleOrderNow} onOpenLoyalty={handleOpenLoyalty} onOpenReservations={handleOpenReservations} />
      <HeroSection logoUrl={LOGO_URL} showLogo={welcomeDismissed} />
      {settings?.events_enabled !== false && (
        <LazySection>
          <Suspense fallback={null}>
            <EventosSection />
          </Suspense>
        </LazySection>
      )}
      <Suspense fallback={null}>
        <MenuSearchBar />
      </Suspense>
      {hasFavorites && (
        <Suspense fallback={null}>
          <FavoritesSection />
        </Suspense>
      )}
      <FavoriteToast />
      <CartRemoveToast />
      {settings?.gallery_enabled !== false && (
        <LazySection>
          <Suspense fallback={null}>
            <GallerySection />
          </Suspense>
        </LazySection>
      )}
      {showShareExperience && (
        <LazySection>
          <Suspense fallback={null}>
            <ShareExperienceSection />
          </Suspense>
        </LazySection>
      )}
      <LazySection>
        <Suspense fallback={null}>
          <SidesSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <MenuSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <BonelessSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <BurgersSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <HotDogsSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <CombosSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <MicheladaSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <BarrilSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <BeerSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <PacificoBeersSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <HalfBeersSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <AmpolletasSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <CaguamasSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <NonAlcoholicBeersSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <VasosPreparadosSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <ShotShowsSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <PreparadosSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <AzulitosSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <CannedAlcoholicSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <BebidasSinAlcoholSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <CigarrettesSection />
        </Suspense>
      </LazySection>
      {showReservations ? (
        <Suspense fallback={null}>
          <MisReservacionesSection highlight={reservationsHighlight} />
        </Suspense>
      ) : (
        <LazySection>
          <Suspense fallback={null}>
            <MisReservacionesSection />
          </Suspense>
        </LazySection>
      )}
      <LazySection>
        <Suspense fallback={null}>
          <HoursSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <LocationSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </LazySection>

      {/* Sección SEO de texto descriptivo — SIN LazySection para que renderice inmediatamente y mejore text-to-HTML ratio */}
      <SeoTextSection />

      <WelcomeModal onDismiss={handleWelcomeDismiss} forceShow={showWelcome} />
      {showLoyalty && !showWelcome && (
        <Suspense fallback={null}>
          <LoyaltyModal onDismiss={handleLoyaltyDismiss} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <LoyaltyReminder onOpenModal={handleOpenLoyalty} />
      </Suspense>
      {showWhatsApp && (
        <Suspense fallback={null}>
          <WhatsAppFloat onOrderNow={handleOrderNow} />
        </Suspense>
      )}

      {cartButton}
    </div>
    </PausedProvider>
  );
}