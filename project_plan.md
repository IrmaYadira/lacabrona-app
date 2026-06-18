# La Cabrona Alitas & Beer

## 1. Project Description
Plataforma digital completa para el bar "La Cabrona Alitas & Beer" ubicado en barlacabrona.com. Bar especializado en alitas de pollo, cerveza fría, billar y ambiente deportivo en Zapopan, Jalisco.

El proyecto ha evolucionado de una simple página informativa a un ecosistema digital completo que incluye:
- Presencia web pública con menú digital, reservas y SEO local
- Sistema de Punto de Venta (POS) para operación interna del bar
- Panel de administración con reportes, inventario y gestión
- Programa de lealtad con tarjeta digital y recompensas
- Notificaciones push para clientes
- Asistente IA (Mesera Virtual) integrado
- PWA para experiencia móvil nativa

Target: Clientes locales de Zapopan y Guadalajara que buscan un bar de alitas con ambiente familiar y deportivo.

## 2. Page Structure (14 páginas)

### Páginas Públicas (indexables)
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/` | Home | Landing page con Hero, secciones de menú, eventos, ubicación, FAQ |
| `/menu` | Menú Digital | Menú completo con carrito, favoritos, pedidos por WhatsApp |
| `/reservas` | Reservas | Sistema de reservación de mesas online |
| `/landing` | Landing Alternativa | Landing page secundaria |

### Páginas de Cliente (no indexables)
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/cuenta` | Mi Cuenta | Vista en tiempo real del consumo y cuenta activa del cliente |
| `/mis-cuentas` | Historial | Historial de cuentas pasadas del cliente |
| `/mi-tarjeta` | Tarjeta Lealtad | Tarjeta digital con puntos, recompensas y selfie |
| `/buscar-cuenta` | Buscar Cuenta | Búsqueda de cuenta por nombre o mesa |
| `/bienvenida` | Bienvenida | Página post-registro/login del cliente |
| `/gracias` | Gracias | Página de agradecimiento post-pago |
| `/qr` | QR | Página de acceso rápido vía código QR |

### Páginas Internas / Staff (no indexables)
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/pos` | Punto de Venta | Sistema POS completo para meseros y bar |
| `/billar` | Billar | Gestión de mesas de billar |
| `/billar/renta` | Renta Billar | Registro de renta de mesa de billar |
| `/admin` | Administración | Panel de control y reportes |

## 3. Features Implementados

### 3.1 Home Page (/)
- [x] Hero section con imagen de fondo y overlay
- [x] Secciones de menú: Alitas, Boneless, Hamburguesas, Hot Dogs, Cervezas, Micheladas, Preparados, Botanas, Bebidas sin Alcohol, Shots, Combos
- [x] Sección de Eventos Especiales (Mundial 2026, promos semanales)
- [x] Galería de fotos del bar
- [x] Sección de Ubicación con Google Maps embed
- [x] Horarios de atención
- [x] Testimonios de clientes
- [x] Sección de Favoritos del cliente
- [x] WhatsApp Float button
- [x] Footer con links, redes sociales y SEO text
- [x] SEO estático completo (JSON-LD, FAQPage, Event, AggregateRating, BreadcrumbList)
- [x] Skeleton de carga para LCP rápido
- [x] Banner de instalación PWA

### 3.2 Menú Digital (/menu)
- [x] Carrito de compras con persistencia
- [x] Búsqueda de productos
- [x] Favoritos con toast de confirmación
- [x] Modal de opciones de burgers, alitas (salsas), micheladas (sabores)
- [x] Variant picker para productos con opciones
- [x] Notas de producto
- [x] Pedido rápido vía WhatsApp
- [x] Ofertas flash con banner animado
- [x] Banner de promo del día
- [x] Badge de puntos de lealtad
- [x] FAB para llamar mesero
- [x] Cámara selfie para foto de perfil
- [x] Notificaciones push (EnablePushBanner)
- [x] Sonido de oferta
- [x] Confetti overlay en momentos especiales
- [x] Floating savings indicator
- [x] Historial de pedidos del carrito

### 3.3 POS - Punto de Venta (/pos)
- [x] Login para staff
- [x] Panel principal con spots (mesas) del bar
- [x] Vista de cuenta individual (AccountView)
  - Agregar/quitar productos
  - Modificar cantidades
  - Múltiples variantes y extras
  - Descuento automático de inventario
- [x] Takeaway (pedidos para llevar)
- [x] CapitanBot (pedidos asistidos por bot)
- [x] Kitchen View (vista de cocina)
- [x] Cierre de cuenta con múltiples métodos de pago
- [x] Corte de caja (CashBreakdown)
- [x] Impresión de ticket (Bluetooth)
- [x] WhatsApp Tickets
- [x] Fusión de cuentas (Merge)
- [x] Apertura de cuenta nueva
- [x] Directorio de clientes
- [x] Perfil e historial de cliente
- [x] Panel de productos pausados/agotados
- [x] Log de disponibilidad de productos
- [x] Notificaciones de mesero (waiter calls)
- [x] Notificaciones de pedidos web (WebOrderNotificationPanel)
- [x] Ready to deliver panel
- [x] Ya Sabe Menú (acceso rápido)

### 3.4 Admin Panel (/admin)
- [x] Login administrativo
- [x] Dashboard con stats del día
- [x] Historial de ventas
- [x] Top productos
- [x] Reporte de cuentas abiertas
- [x] Reporte de cuentas abandonadas con alertas
- [x] Cierre de cuenta desde admin
- [x] Edición de pagos
- [x] Vista de cocina administrativa
- [x] Quick Sale (venta rápida)
- [x] Gestión de inventario
  - Agregar/editar productos
  - Entrada de stock
  - Ajuste de inventario
  - Cuadre físico
  - Merma
  - Entrada masiva con comprobante
- [x] Gestión de ofertas flash
- [x] Gestión de recompensas de lealtad
- [x] Vista de lealtad (ranking, historial, entregas pendientes)
- [x] Vista de reservas
- [x] Vista de eventos especiales
- [x] Pedidos web vs POS
- [x] Panel de configuración del sitio
- [x] Diagnóstico de push notifications
- [x] Reporte de productos revisados hoy
- [x] Gestión de mesas de billar
- [x] Live Order Notifier

### 3.5 Sistema de Lealtad
- [x] Clientes registrados con puntos
- [x] Tarjeta digital personalizada (/mi-tarjeta)
  - Foto de perfil (selfie upload vía edge function)
  - Total de puntos acumulados
  - Nivel de lealtad
- [x] Recompensas canjeables
- [x] Redenciones con ajuste de puntos
- [x] Ranking de clientes
- [x] Historial de puntos
- [x] Entregas pendientes de recompensas
- [x] Ajustes manuales de puntos
- [x] Badge de puntos en menú

### 3.6 Reservas (/reservas)
- [x] Formulario de reservación con fecha, hora, personas
- [x] Vista administrativa de reservas
- [x] Mis Reservas (cliente)

### 3.7 Billar
- [x] Gestión de 2 mesas de billar
- [x] Tarifas por tiempo ($40 media hora, $70 hora, etc.)
- [x] Registro de renta con INE
- [x] Vista administrativa

### 3.8 Notificaciones Push
- [x] Suscripción de clientes
- [x] VAPID keys generadas en Supabase
- [x] Envío de notificaciones vía edge function
- [x] Banner para habilitar notificaciones
- [x] Diagnóstico en admin

### 3.9 Mesera Virtual (AI Agent)
- [x] Widget de chat IA integrado
- [x] Modo hybrid (chat + voice)
- [x] Tema oscuro con acento ámbar
- [x] FAB para reabrir cuando está cerrada
- [x] Carga diferida para no bloquear LCP

### 3.10 PWA
- [x] Service Worker con estrategia de caché
- [x] Manifest con iconos
- [x] Instalable en móvil
- [x] Banner de instalación
- [x] Soporte offline básico

### 3.11 SEO & Performance
- [x] robots.txt bloqueando páginas internas
- [x] Sitemap con URLs indexables
- [x] Meta tags dinámicos (usePageSEO hook)
- [x] JSON-LD estructurado (BarOrPub, FAQPage, Event, AggregateRating, BreadcrumbList)
- [x] Geo tags para SEO local (Zapopan, Jalisco)
- [x] Open Graph y Twitter Card
- [x] Canonical URLs
- [x] Skeleton CSS para FCP instantáneo
- [x] DNS prefetch y preconnect para recursos externos
- [x] Carga no-bloqueante de fuentes e iconos
- [x] Code splitting con lazy loading de rutas
- [x] Compresión gzip + brotli en build
- [x] SEO fallback estático para crawlers

## 4. Stack Técnico

### Frontend
- React 19 + TypeScript
- Vite (build tool)
- Tailwind CSS v3 (estilos)
- React Router DOM v7 (routing)
- Remix Icon + Font Awesome (iconos)
- Google Fonts (Bebas Neue, Inter)

### Backend / Infraestructura
- **Supabase**: Base de datos PostgreSQL, autenticación, storage, edge functions, realtime
- **Readdy AI**: Widget de asistente IA, procesamiento de formularios, almacenamiento de assets

### Edge Functions (Supabase)
| Función | Propósito |
|---------|-----------|
| `chivas-fixtures` | Fixtures del Mundial 2026 |
| `get-vapid-public-key` | Obtener clave pública para push notifications |
| `send-push-notification` | Enviar notificación push a dispositivo |
| `send-verification-code` | Enviar código de verificación por SMS |
| `upload-loyalty-selfie` | Subir foto de perfil de lealtad |
| `upload-receipt` | Subir comprobante de entrada de inventario |
| `upload-selfie` | Subir selfie del cliente |

## 5. Base de Datos (33 tablas en Supabase)

### Tablas de Producto (Shop)
| Tabla | Descripción |
|-------|-------------|
| `product_categories` | Categorías de productos del menú |
| `product_items` | Productos individuales con precio, stock, imágenes |
| `product_variants` | Variantes de producto (ej. tamaños, sabores) |
| `product_skus` | SKUs con precio y stock por variante |
| `product_custom_fields` | Campos personalizados de producto |
| `product_custom_values` | Valores de campos personalizados |

### Tablas de Órdenes
| Tabla | Descripción |
|-------|-------------|
| `order_headers` | Encabezados de pedidos online |
| `order_items` | Items de pedidos online |

### Tablas Operativas (POS)
| Tabla | Descripción |
|-------|-------------|
| `pos_accounts` | Cuentas activas en el bar |
| `pos_account_items` | Productos en cada cuenta |
| `pos_payments` | Pagos registrados |
| `pos_account_events` | Eventos de cuenta (apertura, cierre, etc.) |
| `pos_customers` | Clientes registrados |
| `pos_abandoned_checks` | Cuentas abandonadas sin pagar |

### Tablas de Lealtad
| Tabla | Descripción |
|-------|-------------|
| `loyalty_redemptions` | Canjes de recompensas |
| `loyalty_point_adjustments` | Ajustes manuales de puntos |
| `loyalty_rewards` | Recompensas disponibles |

### Tablas de Inventario
| Tabla | Descripción |
|-------|-------------|
| `inventory_adjustments` | Movimientos de inventario (entrada, ajuste, venta, merma, cuadre) |
| `physical_inventory_counts` | Conteos físicos de inventario |
| `product_availability_log` | Log de productos pausados/agotados |
| `paused_products` | Productos actualmente pausados |

### Tablas de Features
| Tabla | Descripción |
|-------|-------------|
| `reservations` | Reservas de mesas |
| `waiter_requests` | Llamadas a mesero |
| `flash_offers` | Ofertas flash activas |
| `promos_semana` | Promociones de la semana |
| `eventos_especiales` | Eventos especiales del bar |
| `billar_mesas` | Mesas de billar y rentas |
| `push_subscriptions` | Suscripciones a notificaciones push |
| `push_vapid_keys` | Claves VAPID para web push |
| `phone_verifications` | Verificaciones de teléfono |
| `site_settings` | Configuración general del sitio |

## 6. Sistema de Inventario (POS Integration)
- [x] Tabla `product_items` como inventario central de todos los productos del bar
- [x] Tabla `inventory_adjustments` para historial completo de movimientos
- [x] Panel de inventario en Admin con todas las operaciones
- [x] Entrada masiva de productos con comprobante
- [x] Descuento automático de stock al vender desde POS (AccountView, TakeawayView, CapitanBot)
- Tipos de movimiento: `entry`, `adjustment`, `sale`, `physical_count`, `waste`

## 7. Lo que NO se ha implementado (opcional futuro)

- [ ] Pagos con Stripe online (el bar maneja pagos en efectivo y tarjeta en local)
- [ ] Integración con Shopify (no aplica — menú propio, no e-commerce tradicional)
- [ ] Autenticación de clientes vía Supabase Auth (actualmente usan verificación por teléfono)
- [ ] Pedidos online con delivery tracking
- [ ] App nativa móvil (la PWA cubre esta necesidad)
- [ ] Multi-idioma completo (actualmente solo español)

## 8. URLs y Configuración

- **Dominio principal**: barlacabrona.com
- **Sitemap**: barlacabrona.com/sitemap.xml
- **robots.txt**: Bloquea `/admin`, `/pos`, `/bienvenida`, `/cuenta`, `/gracias`, `/mi-tarjeta`, `/qr`, `/mis-cuentas`, `/buscar-cuenta`, `/billar`
- **Páginas indexables**: `/`, `/menu`, `/reservas`, `/landing`
- **Google Search Console**: Sitemap procesado correctamente (8 URLs descubiertas)

## 9. Mantenimiento y Deuda Técnica

### Mejoras pendientes
- [ ] `/cuenta/page.tsx` tiene ~2100 líneas — debería dividirse en componentes más pequeños
- [ ] `/bienvenida` y `/cuenta` usan manipulación directa del DOM para SEO en vez de `usePageSEO`
- [ ] Actualizar `project_plan.md` periódicamente cuando se agreguen features nuevos

### Salud del proyecto
- Build: ✅ Pasando sin errores
- Rutas: ✅ 14 páginas, todas conectadas con lazy loading
- SEO: ✅ Etiquetas meta, JSON-LD, robots.txt, sitemap — todo correcto
- Base de datos: ✅ 33 tablas con RLS configurado
- Edge Functions: ✅ 7 funciones desplegadas
- Performance: ✅ Code splitting, compresión gzip+brotli, skeleton CSS, prefetch DNS