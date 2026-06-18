import { Link } from "react-router-dom";
import { barInfo } from "@/mocks/menu";

export default function Footer() {
  const getWhatsAppLink = () => {
    const text = encodeURIComponent("Hola La Cabrona! Tengo una consulta");
    return `https://wa.me/523348567795?text=${text}`;
  };

  return (
    <footer className="bg-amber-900 text-white">
      <div className="w-full px-4 md:px-8 py-12 md:py-16 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          <div>
            <h3 className="font-[Bebas_Neue] text-2xl tracking-wide mb-4">
              LA CABRONA
            </h3>
            <p className="text-amber-200/70 text-sm leading-relaxed">
              Las mejores alitas y cerveza fría de la ciudad. Sabor
              auténtico, actitud cabrona.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-base mb-4">Enlaces</h4>
            <ul className="space-y-2 text-sm text-amber-200/70">
              <li>
                <button
                  onClick={() =>
                    document
                      .getElementById("menu")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Menú
                </button>
              </li>
              <li>
                <button
                  onClick={() =>
                    document
                      .getElementById("cervezas")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Cervezas
                </button>
              </li>
              <li>
                <button
                  onClick={() =>
                    document
                      .getElementById("combos")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Combos
                </button>
              </li>
              <li>
                <button
                  onClick={() =>
                    document
                      .getElementById("horarios")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Horarios
                </button>
              </li>
              <li>
                <button
                  onClick={() =>
                    document
                      .getElementById("como-llegar")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Cómo Llegar
                </button>
              </li>
              <li>
                <Link
                  to="/reservas"
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 font-semibold text-amber-300"
                >
                  <i className="ri-calendar-event-line" /> Reservar Mesa
                </Link>
              </li>
              <li>
                <Link
                  to="/buscar-cuenta"
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 font-semibold text-amber-300"
                >
                  <i className="ri-receipt-line" /> Ver mi cuenta
                </Link>
              </li>
              <li>
                <Link
                  to="/mis-cuentas"
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <i className="ri-history-line" /> Mis cuentas guardadas
                </Link>
              </li>
              <li>
                <Link
                  to="/billar"
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>🎱</span> Reglamento de Billar
                </Link>
              </li>
              <li>
                <Link
                  to="/billar/renta"
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>🎱</span> Mesas de Billar
                </Link>
              </li>
              <li>
                <Link
                  to="/admin"
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-amber-200/50 text-xs"
                >
                  <i className="ri-dashboard-line" /> Panel Admin
                </Link>
              </li>
              <li>
                <Link
                  to="/pos"
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-amber-200/50 text-xs"
                >
                  <i className="ri-store-line" /> POS
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-base mb-4">Contacto</h4>
            <ul className="space-y-2 text-sm text-amber-200/70">
              <li className="flex items-center gap-2">
                <i className="ri-map-pin-line text-amber-400" />
                {barInfo.address}
              </li>
              <li className="flex items-center gap-2">
                <i className="ri-phone-line text-amber-400" />
                {barInfo.phone}
              </li>
              <li className="flex items-center gap-2">
                <i className="ri-time-line text-amber-400" />
                {barInfo.hours.viernes}
              </li>
            </ul>
            <div className="flex gap-3 mt-4">
              <a
                href={barInfo.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center bg-amber-800 hover:bg-amber-700 rounded-full transition-colors"
              >
                <i className="ri-facebook-fill text-sm" />
              </a>
              <a
                href={barInfo.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center bg-amber-800 hover:bg-amber-700 rounded-full transition-colors"
              >
                <i className="ri-instagram-line text-sm" />
              </a>
              <a
                href={getWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center bg-amber-800 hover:bg-green-600 rounded-full transition-colors"
              >
                <i className="ri-whatsapp-line text-sm" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-amber-800 mt-10 pt-6 text-center text-xs text-amber-200/50">
          <p>© 2026 La Cabrona Alitas & Beer. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}