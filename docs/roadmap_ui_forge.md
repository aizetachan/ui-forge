# UI Forge: Evolution Roadmap & Visión a 3 Meses

Este documento traza la evolución histórica del ecosistema **UI Forge** (Desktop, Plataforma Web de Landing y Admin Web App), mostrando cómo pasó de un experimento de aislamiento de componentes a una infraestructura comercial completa. Finalmente, proyecta los hitos tácticos y estratégicos para los próximos 3 meses (Trismestre entrante).

---

## 🏗️ Fase 1: Génesis y Motor Core (Pasado)
*El problema original: La fricción extrema entre la actualización de componentes del Design System (GenDS) desde la concepción del diseño en Figma hasta su implementación inflexible en el código React.*

### Hitos Clave Alcanzados:
*   **Aislamiento del Renderizador:** Identificación del problema de colisión de estilos globales y dependencias. Desarrollo de una primera versión del visor que separaba la interfaz de la aplicación de las librerías cargadas.
*   **Sandbox IPC (Electron):** Migración oficial hacia Electron para lograr un acceso de bajo nivel (Node.js) al sistema de archivos del usuario. Configuración del `iframe` seguro para comunicación mediante mensajes (`postMessage` IPC) y separación total del contexto de ejecución de estilos entre el "Canvas" y los paneles de la UI.
*   **Engine RepoParser v1.0:** Desarrollo del analizador estático para leer y abstraer propiedades, metadatos y componentes estructurados. Se sentaron las bases para leer `CSS Modules` e interactuar con tokens.
*   **Manejo Local de Git (Motor Síncrono):** Construcción del panel interactivo para conectar repositorios de GitHub sin depender del CLI externo. Soporte para branches, fetching unificado y commit/push desde dentro del editor visual.
*   **Forgecore Schema:** Definición de un manifiesto estándar (`forgecore-template.json`) para que repositorios externos, como *studiogen-ui*, expongan de manera declarativa qué componentes y utilidades (ej. Portals) son accesibles por el motor.

---

## 🚀 Fase 2: Plataformización y Válidación Táctica (Presente - Hasta Hoy)
*El salto de una herramienta de ingeniería aislada a un software SaaS preparado para membresías.*

### Ecosistema Multi-App y Segregación
*   **División Estructural:** Refactorización del "Gran Monorepo" en infraestructuras comerciales separadas para escalar equipos:
    *   `ui-forge`: La aplicación Desktop principal en base Electron + Vite.
    *   `admin-forge`: La web puramente funcional de control de mandos para gestión B2B.
    *   `forge-functions`: La capa Backend (Firebase Cloud Functions y Webhooks).
    *   `ui-forge-web`: La landing page y puerta de entrada comercial para suscripciones.

### Seguridad y Monetización
*   **Role-Based Access Control (RBAC):** Integración rigurosa de Firebase Firestore Security Rules. Creación de un flujo estricto de aprobación desde "Usuario Pendiente" a roles pagados o Master Admins, impidiendo de forma radical los inicios de sesión (Auth) a usuarios sin licencia de producto validada en base de datos.
*   **Infraestructura Fintech (En Progreso Final):** Configuración de las pasarelas Stripe (`stripeService.ts`) orientadas a B2B SaaS para que la aplicación desktop verifique el estado del *Tier* mensual antes de desencriptar motores de Parseo masivos o uso de Git Push.

### Evolución de Motor
*   **Style Overrides y Hot Reload:** La culminación del Prop Panel Universal. Al vincular los parámetros interactivos de UI Forge directly a las Custom Properties de CSS de un componente renderizado en vivo y procesar el cambio vía WebSockets locales, la "Caja Negra" dejó de ser negra. Edición de *Layouts, Tokens de Color y Espaciado* con efecto directo sobre el archivo nativo local.

---

## 🎯 Fase 3: Roadmap Táctico a 3 Meses Vista (Futuro Próximo)
*Pasar de la estabilización estructural pura al despliegue comercial (Beta Tester Program) y la amplificación de casos de uso (Complejidad de AST).*

### Mes 1: Consolidación SaaS & Lanzamiento "Early Access"
**Objetivo:** Tener el embudo de monetización, desde que un cliente paga en la landing hasta que instala el ejecutable local y clona su repo, funcionando en producción continua.

*   **Puesta de largo Web:** Finalizar la pasarela Stripe (`ui-forge-web` / `forge-functions`) garantizando un flujo "Checkout -> Creación de Firestore Doc -> Aprobación Automática (Auto-Provisioning)".
*   **Admin Forge V1 Final:** Dashboard final del `admin-forge` permitiendo anular tokens de sesión desktop o suspender repositorios con problemas de cuotas.
*   **Release Electron Firmada:** Transición del modo Dev a empaquetados firmados y estables en plataforma Windows y macOS (Apple Silicon/Intel) para distribución fuera de nuestro círculo de ingeniería.

### Mes 2: Profundidad en el Pipeline Visual (Manipulación Estructural AST)
**Objetivo:** Ir más allá de los estilos y las props simples. Dotar de "Drag & Drop" a componentes dependientes.

*   **Edición No-Destructiva de AST:** Pasar de la inyección de propiedades tipo "string/boolean" o `styles` en el Universal Panel a posibilitar inyecciones estructurales (ej. Reordenar *Childrens* dentro de un Modal que ya traía el código de repositorio) sin romper las importaciones nativas ni lógicas puras.
*   **Optimización de Grandes Repositorios (B2B):** Migrar de escaneos agresivos totales (Parseo Síncrono Global) a carga On-Demand (Lazy Parsing) para que clonar el frontend enterprise de una financiera de 15,000 archivos no colapse el motor de V8 del cliente en el arranque.
*   **Soporte Extendido de Variantes GenDS:** Asegurar que variantes complejas de diseño (Hover States, Dark Mode Hooks) sean universalmente manejables desde el panel lateral y el Iframe visual sin intervención del CLI.

### Mes 3: Componente Social e IA Foundation
**Objetivo:** Abrazar la iteración asíncrona ("Presence") y arrancar la base para los *Agentes AI Function Callers*.

*   **Comments & Triage en Canvas (Sistema de Presencia Real-time):** Aprovechar Firestore para añadir una capa transparente sobre el Figma/Canvas de UI Forge. Permitir a Product Managers "anclar" un Pin descriptivo de corrección sobre el *Render Live* del componente que se guardará adosado al commit de Git asociado. Integración del trabajo previo documentado en la arquitectura colaborativa.
*   **Proof of Concept "Generative Engine":** Las bases de la visión grande. Enganchar internamente una CLI o endpoint privado para que el usuario inserte una directiva (prompt) sobre un componente seleccionado localmente, y la base de AST de UI Forge genere un mini-Pull Request modificando esa prop o estilo basándose no en Strings inventados, sino puramente en los CSS Tokens reales de su `forgecore-template.json`.
*   **Plugin API Beta:** Permitir inyectar `linters` de empresa dentro del engine de validación visual de UI Forge antes de que la app te deje pulsar "Push to Remote".
