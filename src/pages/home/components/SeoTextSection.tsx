import { useState } from 'react';

export default function SeoTextSection() {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="bg-gray-950 px-5 py-8 border-t border-gray-800">
      <div className="max-w-3xl mx-auto">
        <h2
          className="text-white text-xl font-bold mb-4 leading-tight"
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}
        >
          LA CABRONA ALITAS & BEER — ZAPOPAN, JALISCO
        </h2>

        <p className="text-gray-400 text-sm leading-relaxed mb-3">
          <strong className="text-white">La Cabrona Alitas & Beer</strong> es el bar de alitas de pollo más popular de Zapopan, Jalisco. Ubicado en Calle Sinaloa 690, Colonia El Mante, nuestro establecimiento ofrece una experiencia gastronómica única que combina alitas crujientes, cervezas frías, micheladas preparadas y un ambiente familiar diseñado para la diversión. Desde nuestra apertura, nos hemos convertido en el destino favorito de los vecinos de El Mante y de quienes visitan Zapopan desde Guadalajara y alrededores.
        </p>

        <p className="text-gray-400 text-sm leading-relaxed mb-3">
          Nuestro menú está pensado para satisfacer todos los gustos. Las <strong className="text-white">alitas de pollo</strong> son nuestra especialidad: crujientes, jugosas y disponibles en 13 sabores diferentes que van desde los clásicos BBQ y Buffalo hasta opciones más atrevidas como Mango Habanero, Chipotle, Teriyaki, Parmesano, Ajo, Ranch, Cajún, Sriracha, Picante y Miel. Cada orden se prepara al momento con pollo fresco y nuestra salsa secreta que las hace irresistibles. También ofrecemos <strong className="text-white">boneless</strong> en los mismos sabores, perfectos para quienes prefieren disfrutar sin hueso.
        </p>

        <p className="text-gray-400 text-sm leading-relaxed mb-3">
          Además de alitas, contamos con <strong className="text-white">hamburguesas artesanales</strong> elaboradas con carne de res de alta calidad, pan recién horneado y toppings frescos. Nuestros <strong className="text-white">hot dogs estilo norteño</strong> son otra opción favorita entre los clientes, servidos con ingredientes generosos y salsas caseras. Para acompañar, ofrecemos una variedad de botanas como papas fritas, aros de cebolla y dedos de queso, ideales para compartir en mesa.
        </p>

        {/* Contenido adicional — visible en el DOM para crawlers aunque colapsado visualmente */}
        <div
          style={{
            maxHeight: expanded ? '9999px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 0.4s ease',
          }}
        >
          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            La sección de bebidas es igualmente impresionante. Servimos <strong className="text-white">cervezas frías</strong> de las mejores marcas nacionales e importadas, incluyendo Corona, Pacífico, Modelo, Victoria, Heineken y más. Nuestras <strong className="text-white">micheladas de 1 litro</strong> son legendarias en la zona: preparadas con cerveza, limón, sal, salsa inglesa, salsa Tabasco y un toque de clamato que las hace perfectas para el calor de Zapopan. También tenemos <strong className="text-white">vasos preparados</strong>, shots de tequila, ron y whisky, preparados, azulitos, charros, cerveza de barril, refrescos, jugos y opciones sin alcohol.
          </p>

          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            El ambiente de <strong className="text-white">La Cabrona</strong> está diseñado para que cada visita sea memorable. Contamos con <strong className="text-white">pantallas deportivas</strong> para ver todos los partidos importantes de fútbol, béisbol, box y UFC. El <strong className="text-white">billar profesional</strong> es otra de nuestras atracciones: dos mesas de billar en perfectas condiciones donde puedes pasar horas jugando con amigos. Las tarifas son accesibles y se requiere identificación oficial vigente para jugar. También organizamos <strong className="text-white">música en vivo</strong> regularmente, eventos especiales y promociones que cambian durante toda la semana.
          </p>

          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            Nuestros <strong className="text-white">horarios de atención</strong> son amplios para que puedas visitarnos cuando más te convenga. Abrimos de lunes a jueves de 13:00 a 00:00 horas, los viernes y sábados de 14:00 a 02:00 horas, y los domingos de 14:00 a 23:00 horas. Los fines de semana suelen ser los días más concurridos, por lo que recomendamos hacer reservaciones con anticipación para asegurar tu mesa. Puedes reservar directamente desde nuestra página web o enviándonos un mensaje por WhatsApp al 33-4856-7795.
          </p>

          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            <strong className="text-white">La ubicación es privilegiada.</strong> Estamos en Calle Sinaloa 690, Colonia El Mante, Zapopan, Jalisco, con fácil acceso desde Avenida Patria. El estacionamiento es amplio y seguro, lo que facilita la visita tanto si vienes en auto como si usas transporte público. Somos pet friendly, así que puedes traer a tu mascota siempre que esté bien comportada. El ambiente es familiar y deportivo, fomentando el respeto y la convivencia sana entre todos nuestros clientes.
          </p>

          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            <strong className="text-white">Hacer un pedido es fácil.</strong> Puedes ordenar directamente en el bar con nuestros meseros, hacer tu pedido por WhatsApp al 33-4856-7795 para llevar o servicio a domicilio, o usar nuestro <strong className="text-white">menú digital</strong> disponible en la página web. El sistema de cuentas digitales te permite revisar tu consumo en tiempo real desde tu celular: busca tu cuenta por nombre o número de mesa y ve exactamente qué has ordenado y cuánto llevas gastado. Aceptamos efectivo, tarjeta de crédito, tarjeta de débito y transferencias bancarias.
          </p>

          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            <strong className="text-white">Nuestro programa de lealtad</strong> recompensa a los clientes frecuentes. Cada compra acumula puntos que puedes canjear por productos gratuitos, descuentos especiales y promociones exclusivas. Los miembros del programa también reciben notificaciones push sobre ofertas flash del día, eventos especiales y nuevas adiciones al menú. Registrarte es gratis y puedes hacerlo desde cualquier visita al bar en Zapopan.
          </p>

          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            <strong className="text-white">Síguenos en redes sociales</strong> para mantenerte al tanto de todas las novedades. En <strong className="text-white">Facebook</strong> compartimos fotos de eventos, promociones especiales y momentos destacados de La Cabrona. En <strong className="text-white">Instagram</strong> publicamos contenido visual de nuestros platillos, el ambiente del bar y las experiencias de nuestros clientes. También puedes dejar tu reseña en Google Maps para ayudar a otros a descubrir nuestro bar. Tu opinión es importante para nosotros y nos ayuda a seguir mejorando cada día en Zapopan, Jalisco.
          </p>

          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            <strong className="text-white">La Cabrona Alitas & Beer</strong> es mucho más que un bar. Es un lugar de encuentro donde la comida, la bebida, el entretenimiento y la buena compañía se unen para crear experiencias memorables. Desde nuestro sistema de cuentas digitales que te permite monitorear tu consumo en tiempo real, hasta nuestro programa de lealtad que recompensa a los clientes frecuentes, todo está diseñado para hacer tu visita más cómoda y placentera. La mesa de billar, las pantallas deportivas, la música en vivo y los eventos especiales complementan nuestra oferta gastronómica para que siempre tengas razones para volver a visitarnos en Calle Sinaloa 690, Colonia El Mante, Zapopan, Jalisco.
          </p>

          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            <strong className="text-white">Ingredientes frescos y de calidad.</strong> Todos los ingredientes que usamos en La Cabrona son frescos y de proveedores locales de Zapopan y Guadalajara. Las verduras se preparan diariamente, la carne se selecciona cuidadosamente, y las salsas se elaboran en el bar con recetas propias que hemos perfeccionado a lo largo de los años. La calidad de nuestros ingredientes es la base de la excelencia gastronómica que ofrecemos en cada plato. Desde el pollo fresco de las alitas hasta la carne de res de las hamburguesas, cada ingrediente cumple con nuestros estándares de frescura y sabor.
          </p>

          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            <strong className="text-white">Servicio a domicilio en Zapopan.</strong> Puedes hacer tu pedido por WhatsApp al 33-4856-7795 y coordinar la entrega a domicilio en Zapopan y zonas aledañas. También puedes ordenar para llevar directamente en el local. El menú digital te permite agregar productos al carrito y enviar tu orden por WhatsApp de forma rápida y sencilla. Nuestro servicio de entrega es rápido y eficiente, para que disfrutes de las mejores alitas y cervezas frías desde la comodidad de tu hogar en El Mante, Zapopan, o cualquier zona cercana.
          </p>

          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            <strong className="text-white">La experiencia completa en La Cabrona.</strong> No importa si vienes solo, en pareja, con amigos o con toda la familia, La Cabrona tiene algo para todos. Los aficionados al deporte pueden disfrutar de los partidos en nuestras pantallas gigantes mientras comparten una cubeta de cervezas. Los amantes del billar pueden pasar horas en nuestras mesas profesionales. Los foodies pueden deleitarse con nuestro menú variado y las salsas artesanales. Y todos pueden disfrutar del ambiente cálido, la música y el servicio amable que nos caracteriza. Ven a descubrir por qué somos el bar de alitas más popular de Zapopan, Jalisco.
          </p>
        </div>

        {/* Botón para expandir / contraer */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-amber-400 text-sm font-semibold hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1 mt-1"
        >
          {expanded ? (
            <>Leer menos <i className="ri-arrow-up-s-line" /></>
          ) : (
            <>Leer más sobre La Cabrona <i className="ri-arrow-down-s-line" /></>
          )}
        </button>
      </div>
    </section>
  );
}