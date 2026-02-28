# Business Model & Pricing Strategy (UI Forge)

UI Forge opera en el mercado B2B (*Business-to-Business*), específicamente en el sector de **Software de Infraestructura y Productividad de Diseño (DevTools SaaS)**. El producto monetiza el ahorro radical de tiempo (Horas de Ingeniería) y la reducción del ancho de banda perdido en traducciones de Figma a React.

---

## 1. Estructura de Ingresos (SaaS Recurring Model)

La monetización no obedece a un pago único, sino a la retención orgánica de los equipos que integran UI Forge como su "Ecosistema de Verdad". El modelo es híbrido (*License + Seats*):

1.  **Free Tier (Growth & Onboarding):**
    *   *Uso:* Personal, Estudiantes, Proyectos Open Source pequeños.
    *   *Límites:* Sólo para repositorios públicos. Máximo de 1 Pull Request originado por UI Forge a la semana.
    *   *Objetivo:* Generar el "Efecto Figma", donde el estudiante aprende a usarlo gratis y fuerza a su futura empresa a pagar por él.
2.  **Pro Plan (Equipos Ágiles y Startups):**
    *   *Precio Propuesto:* **$39 USD / usuario / mes.**
    *   *Alcance:* Repositorios Privados ilimitados. Commits/PR ilimitados. Aislamiento CSS garantizado.
    *   *Modelo:* *Per-Seat* (Por Asiento). Si la agencia tiene 3 diseñadores y 1 PM tocando código, pagan $156/mes.
3.  **Enterprise Plan (Corporativo & Factorías Web):**
    *   *Precio Propuesto:* **$1,499 USD / año + SSO Fee** (Facturación Anual Exclusiva).
    *   *Alcance:* Master Admin Panel (`admin-forge`). Reglas Linter forzosas. Integración Single Sign-On (Okta/Google Workspace). Auditoría de Logs Completa (¿Quién cambió este token?). Priorización de soporte para integraciones `forgecore` exclusivas.

## 2. Anatomía de la Unidad Económica (Unit Economics)

La rentabilidad (Gross Margin) de UI Forge es excepcionalmente alta debido a su arquitectura híbrida:

*   **Coste de Infraestructura Directo (CaaS - Costo de Bienes Vendidos):** Prácticamente nulo por cuenta.
    *   Al ser una aplicación **Electron de escritorio**, el 90% del peso computacional (Clonado Git de 5GB, escaneo del AST del código fuente y Renderizado visual) utiliza la **CPU, RAM y Disco Duro del cliente**, NO los servidores de UI Forge.
    *   El servicio en la nube se reserva solo para *Check de Licencia RBAC (Firebase)* e integraciones seguras, costando ~0.001¢ por usuario activo mensual de alojamiento cloud.
*   **Margen Bruto (Gross Margin):** >95%, permitiendo una masiva reinversión de capital (CAC) en campañas de adquisición comercial, influencers de frontend UX, y patrocinios de eventos Open Source.

## 3. Go-to-Market Strategy (GTM)

### El Nicho Cero (La Cuña)
Intentar vender "un editor visual mejor que Figma" a todo el mundo es un suicidio de marketing. UI Forge entra al mercado como un "Dolor de muelas": **La herramienta B2B para Consultorías de Software que gastan 300h/mes sincronizando su Sistema de Diseño React con Figma.**
1.  **Perfil de Cliente Ideal (ICP):** Director de Producto o *Lead Developer* frustrados que ya tienen un `Design System` propio creado en React (estilo `studiogen-ui`) pero cuyos diseñadores les vuelven locos pidiendo cambios menores de CSS constantemente.
2.  **Mecanismo de Adopción (Bottom-Up):** Un desarrollador backend se descarga el Free Tier para montar rápidamente dashboards visuales usando los componentes puristas de su empresa sin saber CSS. Luego le comparte la licencia a su Product Manager. El Manager ve el ahorro de tickets de Slack y compra 5 Seats para su equipo.
3.  **El Vehículo de Demo:** No hay videos teóricos. La venta B2B corporativa se hace invitando al Lead Engineer potencial a "arrastrar y soltar la propia Web pública de UI Forge clonada en su máquina y hacer un cambio en vivo" antes de la videollamada comercial. El efecto "Whoa" es instantáneo.

## 4. Estructura de Financiación Inicial (Pre-Seed / Bootstrapped)

Ante la disyuntiva de desarrollo propio VS entrada de Venture Capital (Inversores):

-   **Bootstrapped (Situación Actual):** Creado en cero horas laborales externas. Zero Coste de Desarrollo de plantilla (Desarrollado íntegramente por Santferal en fines de semana / nocturno). Puesta en producción de infraestructuras Free Tier (`admin-forge`, Electron dev) costeada enteramente por fondos personales.
-   **Tesis de Inversión Seed:** Si se abriese ronda (Ej: €250k a €500k por un 10-15% del *equity*), los fondos no se quemarán en "AWS Cloud Computing" para clones pesados (como sufre Webflow), sino íntegramente en Nomina C-Level, ingenieros puros de AST profundo para el *Generative Leap* y presupuesto salvaje de Adquisición Digital en B2B Ads enfocados a perfiles CTO.
