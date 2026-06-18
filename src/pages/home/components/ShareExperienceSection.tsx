import ScrollReveal from "@/components/base/ScrollReveal";

const GOOGLE_REVIEW_URL = "https://share.google/j7R7jkuZJhhlF0ldB";
const INSTAGRAM_TAG = "@lacabrona.alitas";
const FACEBOOK_TAG = "La Cabrona Alitas & Beer";
const HASHTAG = "#LaCabronaAlitas";

const steps = [
  {
    icon: "ri-camera-2-line",
    color: "bg-amber-50 text-amber-600 border-amber-200",
    title: "Toma una foto",
    desc: "Tu orden, tu chela, tu mesa — lo que sea que te emocione en este momento",
  },
  {
    icon: "ri-instagram-line",
    color: "bg-pink-50 text-pink-500 border-pink-200",
    title: "Súbela a tus redes",
    desc: `Etiquétanos como ${INSTAGRAM_TAG} y usa ${HASHTAG}`,
  },
  {
    icon: "ri-star-line",
    color: "bg-yellow-50 text-yellow-500 border-yellow-200",
    title: "Deja tu reseña en Google",
    desc: "Ayuda a que más gente nos encuentre. Con o sin foto, tu opinión vale mucho",
  },
];

const socialLinks = [
  {
    id: "instagram",
    label: "Instagram",
    icon: "ri-instagram-line",
    bg: "bg-gradient-to-br from-pink-500 to-orange-400",
    href: "https://www.instagram.com/",
    cta: `Etiqueta a ${INSTAGRAM_TAG}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: "ri-facebook-fill",
    bg: "bg-[#1877F2]",
    href: "https://www.facebook.com/lacabronaoficial",
    cta: `Menciona a ${FACEBOOK_TAG}`,
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: "ri-tiktok-line",
    bg: "bg-gray-900",
    href: "https://www.tiktok.com/",
    cta: `Usa ${HASHTAG}`,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: "ri-whatsapp-line",
    bg: "bg-green-500",
    href: "https://wa.me/?text=" + encodeURIComponent(`¡Estoy en La Cabrona Alitas & Beer! ${HASHTAG} 🍺🔥`),
    cta: "Manda tu foto a los cuates",
  },
];

export default function ShareExperienceSection() {
  return (
    <section className="py-16 md:py-24 bg-gray-950 overflow-hidden">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">

        {/* Header */}
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="inline-flex items-center gap-2 text-amber-400 text-sm font-semibold uppercase tracking-widest mb-3">
              <i className="ri-share-line" />
              Publicidad de la buena
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-white tracking-wide leading-tight">
              ¡COMPARTE TU <span className="text-amber-400">EXPERIENCIA!</span>
            </h2>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
              La mejor publicidad la hace la gente. Si la pasaste bien, cuéntalo — ayudas a que más personas nos descubran y nos motivas a seguir dándole duro.
            </p>
          </div>
        </ScrollReveal>

        {/* Pasos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-12 md:mb-16">
          {steps.map((step, i) => (
            <ScrollReveal key={step.title} delay={i * 100}>
              <div className="relative bg-gray-900 rounded-2xl p-6 border border-gray-800 h-full">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 flex items-center justify-center rounded-xl border flex-shrink-0 ${step.color}`}>
                    <i className={`${step.icon} text-xl`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 flex items-center justify-center bg-amber-500 text-white text-xs font-black rounded-full flex-shrink-0">
                        {i + 1}
                      </span>
                      <h3 className="text-white font-black text-base">{step.title}</h3>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Redes sociales */}
        <ScrollReveal>
          <div className="bg-gray-900 rounded-3xl p-6 md:p-8 border border-gray-800 mb-8">
            <p className="text-white font-black text-lg mb-2 text-center">Comparte aquí</p>
            <p className="text-gray-500 text-sm text-center mb-6">Usa nuestro hashtag para que te veamos y te repostemos</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {socialLinks.map((s) => (
                <a
                  key={s.id}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${s.bg} rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:opacity-90 active:scale-95 transition-all`}
                >
                  <div className="w-10 h-10 flex items-center justify-center">
                    <i className={`${s.icon} text-white text-2xl`} />
                  </div>
                  <span className="text-white font-black text-sm">{s.label}</span>
                  <span className="text-white/70 text-[11px] text-center leading-tight">{s.cta}</span>
                </a>
              ))}
            </div>
            <p className="text-center mt-5">
              <span className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-sm px-4 py-2 rounded-full">
                <i className="ri-hashtag" />
                {HASHTAG}
              </span>
            </p>
          </div>
        </ScrollReveal>

        {/* Google Reviews CTA — el más importante */}
        <ScrollReveal>
          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block group overflow-hidden"
          >
            <div className="relative bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-6 md:p-8 overflow-hidden cursor-pointer hover:from-amber-400 hover:to-amber-500 transition-all active:scale-[0.99]">
              {/* Decoración de fondo */}
              <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full pointer-events-none" />
              <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-white/10 rounded-full pointer-events-none" />

              <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-8">
                {/* Estrellas + Google */}
                <div className="flex-shrink-0 text-center">
                  <div className="w-16 h-16 flex items-center justify-center bg-white rounded-2xl mx-auto mb-2">
                    <i className="ri-google-fill text-3xl text-amber-500" />
                  </div>
                  <div className="flex items-center gap-0.5 justify-center mt-1">
                    {[1,2,3,4,5].map(n => (
                      <i key={n} className="ri-star-fill text-white text-base" />
                    ))}
                  </div>
                </div>

                {/* Texto */}
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-white font-black text-xl md:text-2xl leading-tight">
                    ¿La pasaste bien? ¡Díselo a Google!
                  </h3>
                  <p className="text-white/80 text-sm mt-1.5 leading-relaxed">
                    Una reseña con tu foto nos ayuda a aparecer cuando alguien busca dónde comer alitas en la ciudad. Toma 2 minutos y ayuda un chingo.
                  </p>
                </div>

                {/* Botón */}
                <div className="flex-shrink-0">
                  <div className="flex items-center gap-2 bg-white text-amber-600 font-black px-6 py-3.5 rounded-2xl text-sm group-hover:bg-amber-50 transition-colors whitespace-nowrap">
                    <i className="ri-star-smile-line text-lg" />
                    Dejar reseña en Google
                    <i className="ri-external-link-line text-sm opacity-60" />
                  </div>
                </div>
              </div>
            </div>
          </a>
        </ScrollReveal>

      </div>
    </section>
  );
}