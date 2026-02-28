# UI Forge: Roadmap Ejecutivo y Proyección a 6 Meses (Investor View)

> **Visión General:** De motor de aislamiento de código (Iframe IPC) a un Ecosistema SaaS B2B integral, sentando las bases para ser la infraestructura definitiva de IA Generativa en entornos React/Frontend.

---

### 🟢 FASE 1: Core Engine (Foundations - Completado)
*La ruptura tecnológica: interactuar con código sin corromperlo.*

*   **[✓] Arquitectura Iframe Sandbox:** Renderizado encapsulado de React para aislar dependencias y estilos del editor principal.
*   **[✓] Parser AST (RepoParser v1):** Extracción bidireccional de metadatos desde código puro (TypeScript/JSX/CSS Modules).
*   **[✓] Git Engine Embebido:** Sincronización local, clonado, gestión de ramas, resolución de upstream y generación de commits directo desde la interfaz.
*   **[✓] Estándar Forgecore:** Definición del esquema declarativo (`forgecore-template.json`) universal para asimilar cualquier Design System de empresa.
*   **[✓] Hot-Reload Nativo en Canvas:** Alteración y recompilación en vivo de CSS Modules mediante inyección de pseudo-estados.

---

### 🟡 FASE 2: Ecosistema y Plataforma (Scale-up - Actualidad)
*Construcción del SaaS B2B y estructuración multirrepositorio.*

*   **[✓] Arquitectura Multi-Repo:** Fractura estructural para escalabilidad de equipos: Desktop (`ui-forge`), Panel Admin Web (`admin-forge`), Landing/Growth (`ui-forge-web`) y Backend Serverless (`forge-functions`).
*   **[✓] Universal Properties Panel:** Panel dinámico que auto-genera controles precisos adaptados a las props reales que emite el código local analizado.
*   **[✓] Framework Auth & Securidad:** Implementación Firebase Auth unificado (Google, GitHub, Correo) con Role-Based Access Control (RBAC) amurallado por Cloud Firestore Rules.
*   **[✓] Onboarding Engine AI:** Flujo guiado de onboarding en la app de escritorio utilizando chat interactivo simulado.
*   **[⏳] Facturación Institucional Base:** Conexión Stripe B2B operativa validando *Tiers* (Planes) locales antes del arranque del analizador de código.
*   **[⏳] Empaquetado Desktop Estable:** Pipelines configurados y empaquetadores Electron (unsigned) operativos listos para firma de SO comerciales.

---

### 🚀 FASE 3: Proyección Táctica y Generativa (Visión a 6 Meses)

#### 🎯 MES 1-2: Lanzamiento B2B & Deep Editing
*Profundizando en las entrañas del código (Abstract Syntax Tree).*

*   **Drag & Drop Estructural (No-Destructivo):** Capacidad de reordenar *children* en TSX complejos (ej. mover un botón dento de un div anidado) alterando su AST sin romper los limports lógicos ni los _callbacks_.
*   **Soporte Avanzado GenDS/Portals:** Plena compatibilidad interactiva con overlays, popovers modales interactivos y variantes pesadas de UI.
*   **Dashboard SaaS Centralizado (`admin-forge` v1):** Funciones de revocaciones activas para clientes B2B, monitorización de límites API/hardware y gestión de facturación corporativa en vivo.
*   **Lazy Load Enterprise Parsing:** Arquitectura asíncrona de escrutinio para que repositorios gigantes (>10k archivos) rendericen la UI sin ahogar la CPU del cliente.

#### 🎯 MES 3-4: Colaboración Asíncrona & Extensibilidad Corporativa
*Rompiendo el aislamiento local y metiendo equipo real dentro del componente.*

*   **Real-time Canvas Presence (Figma-like):** Inyección de motor Firebase Realtime para observar quién está testeando qué componente local desde su propio UI Forge paralelamente.
*   **Contextual Comments & Triage:** "Pins" de revisión anclados visualmente a píxeles o coordenadas de nodos del DOM renderizados, que viajan acoplados como tickets de GitHub PR.
*   **Custom Framework Adaptors (Beta API):** Apertura de core para que desarrolladores inyecten parsers *no-React* (Svelte, Vue) de forma comunitaria.
*   **Linter Enforcement:** Posibilidad de que la empresa mande un `plugin` inyectable al UI Forge para que bloquee *Commits Generados Visulmente* si violan el manual de estilo (ej. "no usar rem absolutos").

#### 🎯 MES 5-6: La Singularidad y Era Generativa (The Generative Leap)
*Conversión en Infraestructura de Agentes, no solo editor humano.*

*   **Context-Aware AI Assistant (LLM Integration):** Integración nativa. El modelo de IA local de UI Forge obtiene todo el AST de los componentes como contexto. El usuario dirá *"Ajusta todos los paddings de este bloque para mobile"* y el LLM llamará internamente a nuestras primitivas (*styleOverrides*) en lugar de escupir código ciego.
*   **Generador "From Scratch" Controlado:** El usuario escribe un texto y UI Forge auto-ensambla la estructura TSX inicial utilizando estricta y únicamente los componentes del sistema importado vía `Forgecore Schema`.
*   **Auto-Responsive Triage Engine:** Motor visual capaz de detectar desbordamientos CSS en *viewports* móviles en todo el repositorio y sugerir Pull Requests de media queries automáticas a revisión.
*   **Integración CI/CD "Push & Deploy":** Link definitivo donde pulsar *Push* en UI Forge Desktop propicia un Vercel/Netlify Preview Link retornable automáticamente al panel visual.
