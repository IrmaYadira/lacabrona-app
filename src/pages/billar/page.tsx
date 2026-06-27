import { Link } from "react-router-dom";
import { useEffect } from "react";
import JsonLd from "@/components/JsonLd";

const LOGO_URL = "https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285";

const BILLAR_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://barlacabrona.com/" },
        { "@type": "ListItem", "position": 2, "name": "Billar", "item": "https://barlacabrona.com/billar" }
      ]
    },
    {
      "@type": "WebPage",
      "@id": "https://barlacabrona.com/billar",
      "name": "Billar Profesional en La Cabrona | Reglamento y Tarifas en Zapopan, Jalisco",
      "description": "2 mesas de billar profesionales en La Cabrona Alitas & Beer. Tarifas desde $40 la media hora. Reglamento, costos por daño y consejos para disfrutar tu partida en Zapopan. INE vigente requerida.",
      "url": "https://barlacabrona.com/billar",
      "isPartOf": { "@id": "https://barlacabrona.com/" },
      "about": { "@id": "https://barlacabrona.com/#business" },
      "inLanguage": "es"
    }
  ]
};

export default function BillarPage() {
  useEffect(() => {
    document.title = 'Billar Profesional en La Cabrona | Reglamento y Tarifas — Zapopan, Jalisco';
  }, []);

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <JsonLd data={BILLAR_JSONLD} />
      {/* Header */}
      <div className="bg-amber-900 text-white">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-800 rounded-full mb-4 text-3xl">
            🎱
          </div>
          <h1 className="font-[Bebas_Neue] text-4xl md:text-5xl tracking-widest mb-2">
            Reglamento de Billar
          </h1>
          <p className="text-amber-200/70 text-sm tracking-wide uppercase">
            Bar La Cabrona Alitas &amp; Beer
          </p>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* Sección 1: Uso de mesas */}
        <section className="bg-white rounded-xl border border-amber-100 overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-table-line text-amber-700 text-xl" />
            </div>
            <h2 className="font-[Bebas_Neue] text-xl tracking-wide text-amber-900">
              1. Uso de Mesas
            </h2>
          </div>
          <div className="px-6 py-5 space-y-3">
            <p className="text-gray-700 text-sm leading-relaxed">
              Para rentar una mesa se requiere contar con{" "}
              <strong>identificación INE vigente</strong>. Deberás declarar las
              personas que subirán a esa mesa y responder por ellas.
            </p>
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <i className="ri-group-line text-amber-600 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Máximo 6 personas</strong> por mesa.
              </span>
            </div>
            <p className="text-xs text-gray-500 italic">
              El tiempo comienza a correr desde la entrega del equipo.
            </p>
          </div>
        </section>

        {/* Tarifas */}
        <section className="bg-white rounded-xl border border-amber-100 overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-price-tag-3-line text-amber-700 text-xl" />
            </div>
            <h2 className="font-[Bebas_Neue] text-xl tracking-wide text-amber-900">
              Tarifas de Renta
            </h2>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-amber-50 rounded-lg px-5 py-5 text-center border border-amber-100">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-1">
                  1 Hora
                </p>
                <p className="font-[Bebas_Neue] text-4xl text-amber-900">
                  $70
                </p>
                <p className="text-xs text-gray-500 mt-0.5">pesos</p>
              </div>
              <div className="bg-amber-50 rounded-lg px-5 py-5 text-center border border-amber-100">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-1">
                  ½ Hora
                </p>
                <p className="font-[Bebas_Neue] text-4xl text-amber-900">
                  $40
                </p>
                <p className="text-xs text-gray-500 mt-0.5">pesos</p>
              </div>
            </div>
          </div>
        </section>

        {/* Reglas de conducta */}
        <section className="bg-white rounded-xl border border-amber-100 overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-shield-check-line text-amber-700 text-xl" />
            </div>
            <h2 className="font-[Bebas_Neue] text-xl tracking-wide text-amber-900">
              2. Reglas de Conducta
            </h2>
          </div>
          <div className="px-6 py-5">
            <ul className="space-y-3">
              {[
                { icon: "ri-heart-line", text: "Juega con respeto y orden." },
                {
                  icon: "ri-cup-line",
                  text: "No colocar bebidas ni alimentos sobre la mesa.",
                },
                {
                  icon: "ri-close-circle-line",
                  text: "No golpear el taco contra la mesa, el piso o las paredes.",
                },
                {
                  icon: "ri-forbid-line",
                  text: "Prohibido subirse o sentarse sobre las mesas.",
                },
                {
                  icon: "ri-money-dollar-circle-line",
                  text: "Cualquier daño o pérdida deberá ser cubierta de inmediato.",
                },
                {
                  icon: "ri-alarm-warning-line",
                  text: "La administración puede suspender el juego si no se respetan las reglas.",
                },
                {
                  icon: "ri-logout-box-r-line",
                  text: "Se les pedirá se retiren de las instalaciones en caso de incumplimiento.",
                },
              ].map((rule, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className={`${rule.icon} text-amber-600`} />
                  </div>
                  <span>{rule.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Costos por daño */}
        <section className="bg-white rounded-xl border border-amber-100 overflow-hidden">
          <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-error-warning-line text-red-600 text-xl" />
            </div>
            <h2 className="font-[Bebas_Neue] text-xl tracking-wide text-red-800">
              3. Costos por Daño o Pérdida de Equipo
            </h2>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-2">
              {[
                { emoji: "🔺", item: "Triángulo", price: "$159" },
                { emoji: "⚫", item: "Bola negra (8)", price: "$200" },
                { emoji: "⚪", item: "Bola blanca", price: "$200" },
                { emoji: "🎱", item: "Bola de color", price: "$100 c/u" },
                { emoji: "🪶", item: "Taco de billar", price: "$500 c/u" },
              ].map((cost, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{cost.emoji}</span>
                    <span className="text-sm text-gray-700 font-medium">
                      {cost.item}
                    </span>
                  </div>
                  <span className="font-[Bebas_Neue] text-lg text-red-700 tracking-wide">
                    {cost.price}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4 italic leading-relaxed">
              Cualquier otro daño (envases, tarros, tritón, etc.) se les dará el
              costo en el momento.
            </p>
          </div>
        </section>

        {/* Avisos importantes */}
        <section className="bg-amber-900 text-white rounded-xl overflow-hidden">
          <div className="px-6 py-6 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-group-line text-amber-300 text-base" />
              </div>
              <p className="text-sm font-semibold text-amber-100">
                Ambiente Familiar.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-map-pin-2-line text-amber-300 text-base" />
              </div>
              <p className="text-sm text-amber-200">
                Área de fumar: <strong className="text-amber-100">solo tabaco.</strong>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-thumb-up-line text-amber-300 text-base" />
              </div>
              <p className="text-sm text-amber-200">
                Respeta y juega sanamente.{" "}
                <strong className="text-amber-100">
                  Si no es tu idea, no es lugar para ti.
                </strong>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-vip-crown-line text-amber-300 text-base" />
              </div>
              <p className="text-sm font-bold text-amber-100 uppercase tracking-wide">
                Nos reservamos el derecho de admisión.
              </p>
            </div>
          </div>
        </section>

        {/* Contenido SEO adicional */}
        <section className="bg-white rounded-xl border border-amber-100 p-6">
          <h3 className="font-[Bebas_Neue] text-xl tracking-wide text-amber-900 mb-3">Billar en Zapopan — La Cabrona Alitas &amp; Beer</h3>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            Contamos con 2 mesas de billar profesionales en La Cabrona Alitas &amp; Beer, ubicado en Calle Sinaloa 690, Colonia El Mante, Zapopan, Jalisco. Nuestras mesas están en perfectas condiciones para que disfrutes una partida de billar con tus amigos mientras disfrutas de alitas, boneless, cervezas frías y micheladas. El área de billar está disponible durante nuestro horario de apertura, de martes a domingo.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            Ofrecemos tarifas accesibles para que puedas disfrutar el billar sin gastar de más. La media hora tiene un costo de $40 pesos y la hora completa cuesta $70 pesos. Si necesitas hora y media, el costo es de $110 pesos, y dos horas completas cuestan $140 pesos. Para rentar una mesa de billar es necesario presentar identificación oficial vigente (INE) y declarar a las personas que participarán en el juego.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            El billar en La Cabrona es el complemento perfecto para una noche de alitas y cerveza. Mientras esperas tu orden o simplemente quieres pasar un buen rato, nuestras mesas de billar están listas para ti. El ambiente es familiar y deportivo, con pantallas para ver deportes y música de fondo. Visítanos en Zapopan y disfruta de la mejor combinación: alitas crujientes, cervezas bien frías y una buena partida de billar con los cuates.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            El juego de billar es una tradición que se ha mantenido viva en bares y centros de entretenimiento de todo México. En La Cabrona Alitas &amp; Beer, respetamos esta tradición ofreciendo mesas de billar de calidad profesional con tapetes en excelente estado, tacos bien cuidados y un set completo de bolas. Nuestro equipo de billar se revisa constantemente para garantizar que cada partida se desarrolle sin inconvenientes. El área de billar está ubicada en una zona cómoda del bar, con suficiente espacio para moverse alrededor de las mesas y una iluminación adecuada para apreciar bien cada tiro.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            Las mesas de billar de La Cabrona son ideales tanto para jugadores experimentados como para quienes recién se inician en este deporte. El ambiente relajado del bar permite que los principiantes aprendan sin presión, mientras que los jugadores avanzados pueden disfrutar de partidas competitivas. Es común ver grupos de amigos organizando pequeños torneos informales, rotando entre las mesas y disfrutando de la variedad de alitas y cervezas que ofrecemos. Muchos de nuestros clientes regulares vienen específicamente por el billar, aprovechando la combinación única de buen juego, buena comida y buen ambiente que solo encontrarás en La Cabrona Alitas &amp; Beer en Zapopan.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            La política de identificación para rentar billar responde a nuestro compromiso de cuidar el equipo. A lo largo de los años, hemos aprendido que las personas que se identifican formalmente son más responsables con el uso del material. El triángulo, las bolas de colores, la bola blanca y la bola negra número 8, así como los tacos de madera, representan una inversión significativa que queremos preservar para todos los clientes. Por eso, al entregar el equipo, el personal te explicará brevemente las reglas de uso y te pedirá que revises el estado de las piezas antes de comenzar. Esto protege tanto al cliente como al establecimiento de malentendidos.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed">
            Además del billar, en La Cabrona Alitas &amp; Beer encontrarás una experiencia completa de entretenimiento. El bar cuenta con pantallas donde transmitimos eventos deportivos importantes, desde partidos de fútbol hasta peleas de box y Fórmula 1. La música ambiental crea un entorno perfecto para conversar y reír con los amigos. El menú incluye alitas en más de 10 sabos, boneless crujientes, hamburguesas jugosas, cervezas de importación y nacional, micheladas preparadas al momento, y una selección de bebidas para todos los gustos. Ya sea que vengas por el billar, la comida o simplemente por el ambiente, en La Cabrona siempre te sentirás como en casa. Nos encontramos en Calle Sinaloa 690, Colonia El Mante, Zapopan, Jalisco, y abrimos de martes a domingo para que disfrutes de la mejor experiencia de bar con billar en la zona.
          </p>
        </section>

        {/* Sección de consejos y tips */}
        <section className="bg-white rounded-xl border border-amber-100 p-6">
          <h3 className="font-[Bebas_Neue] text-xl tracking-wide text-amber-900 mb-3">Consejos para Disfrutar tu Partida de Billar</h3>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            Si vas a rentar una mesa de billar en La Cabrona, te recomendamos llegar con tus amigos ya reunidos para aprovechar al máximo el tiempo de renta. El tiempo comienza a contar desde la entrega del equipo, así que organizar quién juega primero y quién espera turno te ayudará a que todos disfruten por igual. Es buena idea que alguien del grupo se encargue de llevar el registro de los tiros o de los puntos si están jugando una modalidad con puntuación. Así todos pueden concentrarse en divertirse sin preocupaciones.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            El mantenimiento de las mesas de billar es fundamental para una buena experiencia. En La Cabrona, nos encargamos de que los tapetes estén siempre limpios y bien estirados, las bandas conserven el bote adecuado y las troneras funcionen correctamente. Sin embargo, como jugador, también puedes contribuir al cuidado del equipo. Evita golpear el taco contra el piso, las paredes o la mesa; no apoyes bebidas ni alimentos sobre el tapete; y retira anillos o pulseras que puedan rayar la superficie. Un pequeño esfuerzo colectivo hace que las mesas duren más y el juego sea mejor para todos.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            Para los principiantes, el billar puede parecer intimidante al principio, pero en realidad es un juego accesible para cualquiera. Empieza por practicar el tiro inicial (break shot), que es el que abre la partida. No te preocupes si no encestas ninguna bola en los primeros intentos; el billar se domina con la práctica. Concéntrate en aprender la postura correcta: pie delantero adelante, cuerpo inclinado cómodamente sobre la mesa, y mano guía (la que apoya el taco) bien estable sobre el tapete. Pide a tus amigos que te den tips y verás cómo rápidamente mejoras.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed">
            Una excelente combinación es pedir tu comida y bebidas antes de comenzar a jugar. Así, cuando llegue la orden, puedes hacer una pausa en el billar, disfrutar de las alitas calientes y las cervezas frías, y luego retomar el juego con más energía. Muchos de nuestros clientes organizan su visita de esta manera: una hora de billar, luego una pausa para comer, y otra hora de billar para cerrar la noche. Con las tarifas de La Cabrona, esta experiencia completa es muy económica y memorable. No olvides que también puedes aprovechar las promociones del día y los descuentos especiales que publicamos en nuestro menú digital.
          </p>
        </section>

        {/* Sección de historia del billar en el bar */}
        <section className="bg-white rounded-xl border border-amber-100 p-6">
          <h3 className="font-[Bebas_Neue] text-xl tracking-wide text-amber-900 mb-3">El Billar en La Cabrona — Una Tradición de Entretenimiento</h3>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            Desde que abrimos las puertas de La Cabrona Alitas &amp; Beer en la Colonia El Mante de Zapopan, el billar ha sido parte esencial de nuestra propuesta de entretenimiento. Incluimos mesas de billar profesionales porque creemos que un buen bar no solo debe ofrecer excelente comida y bebidas, sino también actividades que fomenten la convivencia y el buen humor entre los clientes. El billar cumple perfectamente con ese objetivo: es un juego social que invita a la conversación, a la competencia amistosa y a los momentos memorables entre amigos.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            A lo largo de los años, hemos visto innumerables partidas de billar en nuestras mesas. Desde novatos que aprenden sus primeros tiros hasta jugadores experimentados que dominan efectos y estrategias avanzadas. Hemos presenciado celebraciones de victorias épicas, risas por tiros fallidos y, sobre todo, la construcción de amistades que se fortalecen alrededor del tapete verde. Para muchos vecinos de El Mante y zonas aledañas de Zapopan, La Cabrona se ha convertido en el lugar de referencia para jugar billar los fines de semana, después del trabajo o durante los días de descanso.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            El billar que ofrecemos en La Cabrona es billar de pool, también conocido como billar americano, el formato más popular en bares y centros de entretenimiento de México. El pool se juega con una mesa de seis troneras, 16 bolas numeradas (15 de colores y la bola blanca para golpear), y un taco que se usa para impulsar la bola blanca hacia las demás. Las reglas más comunes son el ocho bola (8-ball) y el nueve bola (9-ball), aunque en un ambiente de bar lo más común es jugar libremente, rotando turnos y disfrutando del proceso sin complicaciones.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            Nuestro compromiso con el billar va más allá de simplemente tener mesas disponibles. También nos aseguramos de que el ambiente alrededor del área de billar sea agradable y funcional. La iluminación está calculada para que no haya deslumbramiento ni sombras que dificulten la visión de los jugadores. El espacio alrededor de las mesas es suficiente para moverse cómodamente, y el piso antideslizante evita accidentes. Además, hemos colocado las mesas en una zona donde el ruido del resto del bar no interfiere con la concentración de quienes juegan, pero tampoco está tan aislada que se pierda la energía del lugar.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed">
            El futuro del billar en La Cabrona Alitas &amp; Beer sigue brillando. Planeamos seguir manteniendo nuestras mesas en las mejores condiciones posibles y evaluamos constantemente la posibilidad de expandir el área de billar si la demanda lo justifica. Nuestro objetivo es que cada cliente que visite La Cabrona por el billar se vaya con ganas de regresar. Ya sea que vengas a jugar una partida rápida antes de cenar, o que pases toda la tarde entre la mesa de billar y la barra disfrutando de alitas, en La Cabrona Alitas &amp; Beer de Zapopan siempre encontrarás un lugar donde el billar, la comida y la buena compañía se unen para crear experiencias inolvidables. Visítanos en Calle Sinaloa 690, Colonia El Mante, y descubre por qué somos el bar con billar favorito de Zapopan.
          </p>
        </section>

        {/* Botones de navegación */}
        <div className="flex flex-col sm:flex-row gap-3 pb-4">
          <Link
            to="/billar/renta"
            className="flex-1 flex items-center justify-center gap-2 border-2 border-amber-400 text-amber-700 hover:bg-amber-50 text-sm font-bold uppercase tracking-wide px-6 py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>🎱</span>
            Ver disponibilidad de mesas
          </Link>
          <Link
            to="/"
            className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold uppercase tracking-wide px-6 py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line" />
            Regresar al menú
          </Link>
        </div>
      </div>
    </div>
  );
}