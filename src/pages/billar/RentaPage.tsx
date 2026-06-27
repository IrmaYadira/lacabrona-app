import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const LOGO_URL = "https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285";

const TOTAL_MESAS = 2;

type EstadoMesa = "disponible" | "ocupada" | "reservada";

interface Mesa {
  id: number;
  numero: number;
  estado: EstadoMesa;
  etiqueta: string | null;
}

const ESTADOS_LABEL: Record<EstadoMesa, { label: string; color: string; dot: string }> = {
  disponible: {
    label: "Disponible",
    color: "bg-green-50 border-green-200 text-green-800",
    dot: "bg-green-400",
  },
  ocupada: {
    label: "Ocupada",
    color: "bg-red-50 border-red-200 text-red-800",
    dot: "bg-red-400",
  },
  reservada: {
    label: "Reservada",
    color: "bg-amber-50 border-amber-200 text-amber-800",
    dot: "bg-amber-400",
  },
};

const TARIFAS = [
  { tiempo: "½ hora", precio: 40 },
  { tiempo: "1 hora", precio: 70 },
  { tiempo: "1½ horas", precio: 110 },
  { tiempo: "2 horas", precio: 140 },
];

export default function RentaPage() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loadingMesas, setLoadingMesas] = useState(true);
  const [showFaq, setShowFaq] = useState(false);

  const faqs = [
    {
      q: "¿Cómo rentar una mesa de billar en La Cabrona?",
      a: "Para rentar una mesa de billar en La Cabrona Alitas & Beer, acércate directamente a la barra con tu identificación INE vigente. El personal te asignará la mesa disponible y te entregará el equipo. No se aceptan reservaciones por teléfono ni por internet. El tiempo comienza a correr desde la entrega del equipo completo.",
    },
    {
      q: "¿Cuánto cuesta rentar una mesa de billar en Zapopan?",
      a: "Nuestras tarifas de billar son: $40 por media hora, $70 por una hora, $110 por hora y media, y $140 por dos horas. Estas tarifas aplican por mesa y no por persona. El cobro se realiza al finalizar tu sesión de juego.",
    },
    {
      q: "¿Cuántas personas pueden jugar en una mesa de billar?",
      a: "Cada mesa de billar tiene un límite máximo de 6 personas. Si vienes en grupo, puedes rotar turnos entre los jugadores. Es importante respetar este límite para mantener el orden y la seguridad en el área de billar.",
    },
    {
      q: "¿Se necesita identificación para rentar billar?",
      a: "Sí, es obligatorio presentar una identificación INE vigente para rentar una mesa de billar. Esta política nos permite asegurar el cuidado del equipo y garantizar que las personas que rentan sean responsables de cualquier daño o pérdida que pueda ocurrir durante el uso.",
    },
    {
      q: "¿Qué pasa si daño una bola o el taco de billar?",
      a: "En caso de daño o pérdida del equipo, se debe cubrir el costo correspondiente de inmediato. Los costos son: triángulo $159, bola negra (8) $200, bola blanca $200, bola de color $100 cada una, y taco de billar $500 cada uno. Cualquier otro daño será evaluado por el personal en el momento.",
    },
    {
      q: "¿Puedo reservar una mesa de billar por teléfono o WhatsApp?",
      a: "No, las mesas de billar no se reservan por teléfono ni por WhatsApp. La asignación de mesas se realiza únicamente en la barra del establecimiento, de forma presencial y en el momento. Recomendamos llegar con tiempo, especialmente los fines de semana cuando la demanda es mayor.",
    },
    {
      q: "¿El ambiente de La Cabrona es familiar?",
      a: "Sí, La Cabrona Alitas & Beer es un bar con ambiente familiar. Fomentamos el respeto y la convivencia sana entre todos nuestros clientes. El área de fumadores está designada exclusivamente para tabaco. Nos reservamos el derecho de admisión para preservar el buen ambiente.",
    },
  ];

  useEffect(() => {
    const fetchMesas = async () => {
      const { data } = await supabase
        .from("billar_mesas")
        .select("*")
        .order("numero");
      if (data) setMesas(data as Mesa[]);
      setLoadingMesas(false);
    };

    fetchMesas();

    const channel = supabase
      .channel("renta-billar-mesas")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "billar_mesas" }, () => {
        fetchMesas();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const disponibles = useMemo(() => mesas.filter((m) => m.estado === "disponible").length, [mesas]);

  const mesasDisplay = useMemo(() => mesas.length > 0 ? mesas : Array.from({ length: TOTAL_MESAS }, (_, i) => ({
    id: i + 1, numero: i + 1, estado: "disponible" as EstadoMesa, etiqueta: null,
  })), [mesas]);

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Header */}
      <div className="bg-amber-900 text-white">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-800 rounded-full mb-4 text-3xl">
            🎱
          </div>
          <h1 className="font-[Bebas_Neue] text-4xl md:text-5xl tracking-widest mb-2">
            Mesas de Billar
          </h1>
          <p className="text-amber-200/70 text-sm tracking-wide uppercase">
            Bar La Cabrona Alitas &amp; Beer
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-amber-800/60 rounded-full px-4 py-1.5 text-sm text-amber-200">
            <span className={`w-2 h-2 rounded-full ${disponibles > 0 ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            {loadingMesas
              ? "Cargando..."
              : disponibles > 0
                ? `${disponibles} de ${TOTAL_MESAS} mesas disponibles`
                : "Todas las mesas ocupadas"}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* Descripción introductoria para SEO */}
        <section className="bg-white rounded-xl border border-amber-100 px-6 py-5">
          <p className="text-gray-700 text-sm leading-relaxed mb-3">
            Disfruta de nuestras <strong>mesas de billar profesionales</strong> en La Cabrona Alitas &amp; Beer, ubicado en Zapopan, Jalisco. Contamos con 2 mesas de billar de alta calidad donde puedes pasar un buen rato con tus amigos mientras disfrutas de nuestras alitas, boneless y cervezas frías. El área de billar está disponible durante todo el horario de operación. Las tarifas son accesibles y el equipo se mantiene en excelentes condiciones para garantizar la mejor experiencia de juego.
          </p>
          <p className="text-gray-700 text-sm leading-relaxed mb-3">
            La Cabrona Alitas &amp; Beer se encuentra en la Calle Sinaloa 690, Colonia El Mante, Zapopan, y es el destino ideal para quienes buscan un bar con billar de calidad en la zona metropolitana de Guadalajara. Nuestras mesas de billar están ubicadas en una zona cómoda del establecimiento, con suficiente espacio para moverse, iluminación adecuada y un ambiente relajado que permite tanto la concentración como la conversación. Ya sea que vengas a jugar una partida rápida antes de cenar o que planees pasar toda la tarde entre amigos, nuestras mesas están listas para recibirte.
          </p>
          <p className="text-gray-700 text-sm leading-relaxed mb-3">
            El sistema de renta de mesas de billar en La Cabrona es sencillo y transparente. No necesitas reservar con anticipación: solo acércate a la barra con tu identificación INE vigente, solicita la mesa que prefieras entre las disponibles, y el personal te entregará el equipo completo. El tiempo de renta comienza a contar desde ese momento, así que asegúrate de que tu grupo ya esté reunido para aprovechar al máximo cada minuto. Las tarifas son claras y fijas: $40 pesos por media hora, $70 por una hora, $110 por hora y media, y $140 por dos horas. El cobro se realiza al finalizar tu sesión de juego.
          </p>
          <p className="text-gray-700 text-sm leading-relaxed mb-3">
            Cada mesa de billar tiene capacidad para un máximo de 6 personas. Esto garantiza que haya suficiente espacio para jugar cómodamente sin aglomeraciones. Si vienes en grupo grande, puedes rotar turnos entre las personas y organizar pequeños torneos informales. Muchos de nuestros clientes aprovechan la renta de billar para combinarla con nuestra oferta gastronómica: piden alitas, boneless y cervezas antes de comenzar, hacen una pausa para comer a mitad de la sesión, y luego retoman el juego con más energía. Es una experiencia completa de entretenimiento que no encontrarás en otro lugar de Zapopan.
          </p>
          <p className="text-gray-700 text-sm leading-relaxed">
            El cuidado del equipo de billar es responsabilidad compartida. Al recibir el material, te pedimos que revises junto con el personal el estado de las bolas, el triángulo, el taco y el resto del equipo. Así ambas partes quedan protegidas ante cualquier eventualidad. En caso de daño o pérdida, los costos son accesibles y se cobran de inmediato: triángulo $159, bola negra $200, bola blanca $200, bola de color $100 cada una, y taco de billar $500 cada uno. Nuestra política de identificación y esta revisión conjunta del equipo nos han permitido mantener las mesas en excelente estado durante años, beneficiando a todos los clientes que las usan.
          </p>
        </section>

        {/* Sección de por qué elegir nuestro billar */}
        <section className="bg-white rounded-xl border border-amber-100 overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-star-line text-amber-700 text-xl" />
            </div>
            <h2 className="font-[Bebas_Neue] text-xl tracking-wide text-amber-900">
              Por Qué Elegir Nuestro Billar en Zapopan
            </h2>
          </div>
          <div className="px-6 py-5 space-y-3">
            <p className="text-gray-700 text-sm leading-relaxed">
              En La Cabrona Alitas &amp; Beer no solo ofrecemos mesas de billar: ofrecemos una experiencia completa de entretenimiento. A diferencia de otros bares de la zona que tienen mesas de billar descuidadas o en mal estado, nosotros invertimos en el mantenimiento constante de nuestro equipo. Los tapetes se revisan periódicamente para asegurar que no tengan desgastes que afecten la trayectoria de las bolas. Las bandas se verifican para mantener el bote correcto. Los tacos se almacenan en condiciones adecuadas para evitar que la madera se deforme. El resultado es un juego fluido y predecible, donde las bolas ruedan de manera uniforme y las troneras capturan correctamente.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">
              La ubicación de nuestras mesas de billar también ha sido pensada estratégicamente. Están lo suficientemente cerca de la barra para que puedas pedir bebidas y alimentos sin recorrer grandes distancias, pero lo suficientemente alejadas de las zonas de alta circulación para que no haya interrupciones constantes durante tus tiros. La iluminación directa sobre cada mesa es brillante y uniforme, sin puntos de sombra que dificulten la visualización de los ángulos. El espacio alrededor de cada mesa permite que varias personas observen la partida sin estorbar al jugador que está en turno.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">
              El ambiente de La Cabrona es otro factor que hace que nuestro billar sea especial. Mientras juegas, puedes disfrutar de música ambiental de buen gusto, pantallas donde transmitimos eventos deportivos en vivo, y la energía positiva de un bar que siempre está lleno de gente buena onda. El personal es atento y amable, y si necesitas algo durante tu partida, solo tienes que levantar la mano o acercarte a la barra. Nuestro objetivo es que no tengas que preocuparte por nada más que por disfrutar el juego y la compañía.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">
              Las tarifas de billar en La Cabrona son de las más competitivas de Zapopan y la zona metropolitana de Guadalajara. Por $40 pesos puedes disfrutar media hora de juego, lo cual es ideal para una partida rápida entre amigos. La tarifa de una hora completa a $70 pesos es la más popular, ya que permite jugar varias partidas sin prisa. Si planeas quedarte más tiempo, la tarifa de hora y media a $110 o dos horas a $140 te ofrecen un valor aún mejor. Y lo mejor: cada mesa se renta por mesa, no por persona. Esto significa que puedes dividir el costo entre los amigos y salir jugando billar por menos de lo que cuesta una bebida en muchos otros lugares.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">
              La seguridad y el orden son prioridades en el área de billar de La Cabrona. El límite de 6 personas por mesa no es arbitrario: está diseñado para garantizar que haya suficiente espacio para jugar sin riesgo de accidentes. El piso alrededor de las mesas es antideslizante, y el área está bien ventilada. Además, el hecho de que seamos un bar con ambiente familiar significa que no hay situaciones incómodas ni conflictos. Si alguna vez surge alguna situación, el personal interviene de inmediato para mantener el ambiente agradable para todos. Ven a La Cabrona Alitas &amp; Beer en Calle Sinaloa 690, Colonia El Mante, Zapopan, y descubre por qué somos la mejor opción de billar en la zona.
            </p>
          </div>
        </section>

        {/* Sección de experiencia del cliente */}
        <section className="bg-white rounded-xl border border-amber-100 overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-emotion-happy-line text-amber-700 text-xl" />
            </div>
            <h2 className="font-[Bebas_Neue] text-xl tracking-wide text-amber-900">
              Experiencia Completa — Billar, Comida y Bebida
            </h2>
          </div>
          <div className="px-6 py-5 space-y-3">
            <p className="text-gray-700 text-sm leading-relaxed">
              Una de las ventajas de jugar billar en La Cabrona Alitas &amp; Beer es que puedes combinar el juego con una experiencia gastronómica excepcional. Imagina esta escena: llegas con tus amigos un viernes por la tarde, rentas una mesa de billar por dos horas, y mientras comienza la primera partida, pides una ronda de alitas BBQ, boneless picantes y micheladas de la casa. El mesero trae la comida a la mesa de billar, haces una pausa para comer y conversar, y luego retomas el juego. Esa combinación de billar, comida y bebida fría es exactamente lo que hace única a La Cabrona.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">
              Nuestro menú está diseñado para ser el complemento perfecto de una tarde de billar. Las alitas están disponibles en más de 10 sabores diferentes, desde clásicas como BBQ y Buffalo hasta opciones más atrevidas como Mango Habanero y Lemon Pepper. Los boneless son crujientes por fuera y jugosos por dentro, ideales para comer entre tiros sin ensuciarse las manos. Las hamburguesas son generosas y satisfactorias, perfectas si vienes con hambre después de una semana de trabajo. Y las bebidas no se quedan atrás: cervezas de importación y nacional, micheladas preparadas al momento con el limón y la salsa exactos, cervezas de barril, y opciones sin alcohol para quienes prefieren no tomar.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">
              Muchos de nuestros clientes regulares tienen rutinas establecidas que combinan billar y comida. Algunos llegan temprano, juegan una hora, cenan, y luego juegan otra hora antes de irse. Otros prefieren hacerlo todo junto: comen mientras juegan, haciendo pausas entre cada partida para picar algo. Algunos grupos organizan pequeños campeonatos de billar, donde el perdedor de cada partida paga la siguiente ronda de cervezas. Las posibilidades son infinitas, y todas giran en torno a la combinación ganadora de billar de calidad, comida deliciosa y bebidas refrescantes en un ambiente inmejorable.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">
              El servicio de mesa en el área de billar es rápido y eficiente. Nuestros meseros conocen bien la dinámica del juego y saben cuándo es apropiado acercarse y cuándo es mejor esperar. Si necesitas algo durante tu partida, solo levantas la mano y alguien vendrá a atenderte. Si prefieres ir tú mismo a la barra, está a solo unos pasos de distancia. No hay necesidad de interrumpir el juego para pedir más bebidas o más alitas. Todo está pensado para que tu experiencia de billar sea lo más fluida y agradable posible.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">
              Además de la comida y las bebidas, La Cabrona ofrece otros elementos que enriquecen la experiencia de billar. Las pantallas de televisión transmiten deportes en vivo, así que si hay un partido importante de tu equipo favorito, puedes verlo entre partidas de billar. La música ambiental es variada y de buen gusto, creando un fondo sonoro agradable sin distraer de la concentración que requiere el juego. Y si es un día especial como Halloween, Día de Muertos, 14 de Febrero o fin de año, el bar se decora con temática y el ambiente se vuelve aún más festivo. Jugar billar en una noche temática de La Cabrona es una experiencia que no se olvida fácilmente. Te esperamos en Calle Sinaloa 690, Colonia El Mante, Zapopan, Jalisco.
            </p>
          </div>
        </section>

        {/* Aviso — solo en barra */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <div className="w-6 h-6 flex items-center justify-center mt-0.5 flex-shrink-0">
            <i className="ri-information-line text-amber-600 text-lg" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900 mb-0.5">Las mesas se asignan en la barra</p>
            <p className="text-sm text-amber-800 leading-relaxed">
              Para rentar una mesa acércate directamente a la barra con tu INE vigente.
              No se hacen reservaciones por teléfono ni por internet.
            </p>
          </div>
        </div>

        {/* Estado de mesas */}
        <section className="bg-white rounded-xl border border-amber-100 overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center">
                <i className="ri-layout-grid-line text-amber-700 text-xl" />
              </div>
              <h2 className="font-[Bebas_Neue] text-xl tracking-wide text-amber-900">
                Estado Actual de Mesas
              </h2>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              En tiempo real
            </span>
          </div>
          <div className="px-6 py-6">
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto w-full mb-6">
              {loadingMesas
                ? Array.from({ length: TOTAL_MESAS }).map((_, i) => (
                    <div key={i} className="rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-5 flex flex-col items-center gap-2 animate-pulse">
                      <div className="w-10 h-10 bg-gray-200 rounded-full" />
                      <div className="w-16 h-4 bg-gray-200 rounded" />
                      <div className="w-20 h-3 bg-gray-200 rounded" />
                    </div>
                  ))
                : mesasDisplay.map((mesa) => {
                    const est = ESTADOS_LABEL[mesa.estado];
                    return (
                      <div
                        key={mesa.id}
                        className={`rounded-xl border-2 px-4 py-5 flex flex-col items-center gap-2 ${est.color}`}
                      >
                        <div className="text-3xl">🎱</div>
                        <p className="font-[Bebas_Neue] text-lg tracking-wide">
                          Mesa {mesa.numero}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${est.dot}`} />
                          <span className="text-xs font-semibold uppercase tracking-wide">
                            {est.label}
                          </span>
                        </div>
                        {mesa.etiqueta && (
                          <p className="text-[11px] opacity-70 text-center leading-tight">
                            {mesa.etiqueta}
                          </p>
                        )}
                      </div>
                    );
                  })}
            </div>
            {/* Leyenda */}
            <div className="flex flex-wrap gap-4 justify-center text-xs text-gray-500">
              {Object.entries(ESTADOS_LABEL).map(([key, val]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${val.dot}`} />
                  {val.label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tarifas */}
        <section className="bg-white rounded-xl border border-amber-100 overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-price-tag-3-line text-amber-700 text-xl" />
            </div>
            <h2 className="font-[Bebas_Neue] text-xl tracking-wide text-amber-900">
              Tarifas
            </h2>
          </div>
          <div className="px-6 py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {TARIFAS.map((t, i) => (
                <div
                  key={i}
                  className="rounded-xl border-2 border-amber-100 bg-amber-50 px-4 py-5 flex flex-col items-center gap-1 text-center"
                >
                  <p className="font-[Bebas_Neue] text-4xl text-amber-900 tracking-wide">
                    ${t.precio}
                  </p>
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">
                    {t.tiempo}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">por mesa</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">
              El tiempo comienza a correr desde la entrega del equipo.
            </p>
          </div>
        </section>

        {/* Requisitos */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: "ri-id-card-line",
              title: "INE Vigente",
              desc: "Se requiere identificación oficial para rentar cualquier mesa. Esto garantiza el cuidado del equipo y la responsabilidad por cualquier daño o pérdida que pueda ocurrir durante el uso de las mesas de billar.",
            },
            {
              icon: "ri-time-line",
              title: "Tiempo desde entrega",
              desc: "El cobro inicia desde que se te entrega el equipo completo. Te recomendamos verificar que todas las bolas, el triángulo y el taco estén en buen estado antes de comenzar tu partida.",
            },
            {
              icon: "ri-group-line",
              title: "Máx. 6 personas",
              desc: "Por cada mesa se permiten hasta 6 personas. Respeta el límite para mantener el orden y la seguridad en el área de billar. Puedes rotar turnos entre los jugadores de tu grupo.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-amber-100 px-5 py-5 flex flex-col items-center text-center gap-3"
            >
              <div className="w-10 h-10 flex items-center justify-center bg-amber-50 rounded-full">
                <i className={`${item.icon} text-amber-700 text-xl`} />
              </div>
              <p className="font-bold text-sm text-gray-800">{item.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </section>

        {/* FAQs colapsable */}
        <section className="bg-white rounded-xl border border-amber-100 overflow-hidden">
          <button
            onClick={() => setShowFaq(!showFaq)}
            className="w-full flex items-center justify-between px-6 py-4 bg-amber-50 border-b border-amber-100 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center">
                <i className="ri-question-line text-amber-700 text-xl" />
              </div>
              <h2 className="font-[Bebas_Neue] text-xl tracking-wide text-amber-900">
                Preguntas Frecuentes sobre el Billar
              </h2>
            </div>
            <i className={`ri-arrow-down-s-line text-xl text-gray-400 transition-transform ${showFaq ? 'rotate-180' : ''}`} />
          </button>
          {showFaq && (
            <div className="px-6 py-5 space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                  <p className="text-sm font-bold text-gray-900 mb-1.5">{faq.q}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Navegación */}
        <div className="flex flex-col sm:flex-row gap-3 pb-4">
          <Link
            to="/billar"
            className="flex-1 flex items-center justify-center gap-2 border-2 border-amber-400 text-amber-700 hover:bg-amber-50 text-sm font-bold uppercase tracking-wide px-5 py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-file-list-3-line" />
            Ver Reglamento
          </Link>
          <Link
            to="/"
            className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold uppercase tracking-wide px-5 py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line" />
            Regresar al menú
          </Link>
        </div>
      </div>
    </div>
  );
}