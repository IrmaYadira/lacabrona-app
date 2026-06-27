import type { TourStep } from "@/components/feature/MenuTour";

export const menuTourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Bienvenido al Menú Digital",
    description: "Este es el menú digital de La Cabrona. Desde acá podés ver todos nuestros productos, armar tu pedido y pedirle ayuda al mesero. ¡Dale siguiente para ver cómo funciona!",
    emoji: "🍗",
    tooltipPosition: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
  },
  {
    id: "categories",
    title: "Explorá las Categorías",
    description: "Acá arriba están todas las categorías: alitas, boneless, hamburguesas, cervezas, micheladas y mucho más. Tocá cualquiera para ir directo a esa sección. También podés deslizar horizontalmente para ver más.",
    emoji: "📋",
    spotlight: { top: "52px", left: "0", width: "100%", height: "48px" },
    tooltipPosition: { top: "120px", left: "50%", transform: "translateX(-50%)" },
  },
  {
    id: "search",
    title: "Buscá lo que se te Antoje",
    description: "¿Se te antoja algo específico? Usá la lupita para buscar cualquier producto por nombre. Escribí \"alitas\", \"corona\" o \"hamburguesa\" y te lo encuentra al instante.",
    emoji: "🔍",
    spotlight: { top: "52px", left: "16px", width: "180px", height: "40px" },
    tooltipPosition: { top: "120px", left: "16px" },
  },
  {
    id: "add-product",
    title: "Agregá Productos al Carrito",
    description: "Cada producto tiene un botón con el signo +. Tocá ese botón para agregar el producto a tu carrito. Las alitas y boneless te van a pedir que elijas salsa, y las hamburguesas que elijas acompañamiento. ¡Probá agregar algo!",
    emoji: "➕",
    spotlight: { top: "50%", left: "65%", width: "48px", height: "48px" },
    tooltipPosition: { top: "40%", right: "16px" },
  },
  {
    id: "cart",
    title: "Así se ve tu Carrito",
    description: "Cuando agregás productos, acá arriba aparece una barra con tu pedido. Tocá \"Ver pedido\" para revisar todo lo que llevás, cambiar cantidades o quitar cosas. El total se actualiza en vivo.",
    emoji: "🛒",
    spotlight: { top: "100px", left: "0", width: "100%", height: "48px" },
    tooltipPosition: { top: "170px", left: "50%", transform: "translateX(-50%)" },
  },
  {
    id: "whatsapp",
    title: "Pedí por WhatsApp",
    description: "¿Preferís que te atienda un mesero? Tocá el botón verde de WhatsApp y te conectás directo con nosotros. También podés hacer tu pedido para llevar o a domicilio por ese mismo canal.",
    emoji: "💬",
    spotlight: { top: "12px", right: "16px", width: "180px", height: "44px" },
    tooltipPosition: { top: "80px", right: "16px" },
  },
  {
    id: "finish",
    title: "¡Ya Estás Listo!",
    description: "Eso es todo. Ahora ya sabés cómo usar el menú digital de La Cabrona. Explorá las categorías, armá tu pedido como más te guste y cuando estés listo pedile al mesero o escribinos por WhatsApp. ¡Buen provecho, cabrón! 🍺🔥",
    emoji: "🎉",
    tooltipPosition: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
  },
];