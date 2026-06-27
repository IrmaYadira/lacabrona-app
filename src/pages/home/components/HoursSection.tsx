import { barInfo } from "@/mocks/menu";
import ScrollReveal from "@/components/base/ScrollReveal";

const DAYS = [
  { key: "lunes", label: "Lunes", short: "Lun" },
  { key: "martes", label: "Martes", short: "Mar" },
  { key: "miercoles", label: "Miércoles", short: "Mié" },
  { key: "jueves", label: "Jueves", short: "Jue" },
  { key: "viernes", label: "Viernes", short: "Vie" },
  { key: "sabado", label: "Sábado", short: "Sáb" },
  { key: "domingo", label: "Domingo", short: "Dom" },
];

export default function HoursSection() {
  const today = new Date().getDay();
  const dayIndex = today === 0 ? 6 : today - 1;

  return (
    <section id="horarios" className="py-16 md:py-24 bg-amber-50">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
              No te quedes con las ganas
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-gray-900 mt-2 tracking-wide">
              HORARIOS DE APERTURA
            </h2>
            <p className="text-gray-500 mt-3 text-sm md:text-base max-w-xl mx-auto">
              Abrimos de martes a domingo para que vengas a pistear como un cabrón. Los lunes descansamos.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 md:gap-4">
          {DAYS.map((day, i) => {
            const hours = barInfo.hours[day.key as keyof typeof barInfo.hours];
            const isClosed = hours === "Cerrado";
            const isToday = i === dayIndex;

            return (
              <ScrollReveal key={day.key} delay={i * 80}>
                <div
                  className={`rounded-xl p-3 md:p-5 text-center border-2 transition-all duration-300 hover:scale-105 ${
                    isToday
                      ? "border-amber-500 bg-amber-500 text-white shadow-lg"
                      : isClosed
                        ? "border-gray-200 bg-white text-gray-400"
                        : "border-amber-200 bg-white text-gray-900 hover:border-amber-400 hover:shadow-md"
                  }`}
                >
                  <p
                    className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-0.5 ${
                      isToday ? "text-amber-100" : isClosed ? "text-gray-400" : "text-amber-600"
                    }`}
                  >
                    {day.short}
                  </p>
                  <p
                    className={`font-semibold text-xs sm:text-sm md:text-base mb-1.5 ${
                      isToday ? "text-white" : ""
                    }`}
                  >
                    {day.label}
                  </p>
                  <div className="border-t border-current/20 pt-1.5">
                    {isClosed ? (
                      <span className="text-[11px] sm:text-xs font-bold">CERRADO</span>
                    ) : (
                      <>
                        <p className="text-[11px] sm:text-xs md:text-sm font-medium leading-tight">
                          {hours.split(" - ")[0]}
                        </p>
                        <p className="text-[11px] sm:text-xs opacity-60 my-0.5">a</p>
                        <p className="text-[11px] sm:text-xs md:text-sm font-medium leading-tight">
                          {hours.split(" - ")[1]}
                        </p>
                      </>
                    )}
                  </div>
                  {isToday && (
                    <div className="mt-1.5 inline-block px-2 py-0.5 bg-white/20 rounded-full">
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                        Hoy
                      </span>
                    </div>
                  )}
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        <ScrollReveal>
          <div className="mt-10 text-center">
            <div className="inline-flex items-center gap-2 bg-white border border-amber-200 rounded-full px-5 py-2.5 shadow-sm">
              <i className="ri-time-line text-amber-500" />
              <span className="text-sm text-gray-700">
                <span className="font-semibold">Viernes y Sábado:</span> abierto hasta las 2:00 AM — la fiesta no para
              </span>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}