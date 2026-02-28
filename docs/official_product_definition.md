# Product Definition Document (PDD)

Este documento define formalmente los límites, alcances y componentes técnicos que conforman el producto estandarizado "UI Forge". Sirve como "Single Source of Truth" para equipos técnicos, fundadores e inversores.

---

## 1. Alcance del Ecosistema

UI Forge no es un simple programa, es una arquitectura multi-nodo diseñada para balancear computo pesado local con seguridad centralizada en la nube.

### A. Desktop App (Electron Engine)
*   **Rol:** El cliente principal (donde el usuario interacciona).
*   **Stack:** Electron + React + Vite + TypeScript.
*   **Responsabilidades:** Acceder al sistema de archivos local del usuario, arrancar los servidores de desarrollo de Vite para renderizar componentes localmente e invocar las integraciones de la CLI nativa de Git. Todo el análisis del "Abstract Syntax Tree (AST)" de TypeScript ocurre aquí para no ahogar servidores externos.

### B. Sandbox Engine (Iframe IPC)
*   **Rol:** El entorno estricto de seguridad visual.
*   **Stack:** Arquitectura dual (*App Wrapper* vs *Component Wrapper*).
*   **Responsabilidades:** Montar un componente (ej. un `Button.tsx` real) en un marco `<iframe>` completamente aislado del DOM del editor, evitando colisión de variables globales CSS y permitiendo la comunicación estricta mediante *PostMessage IPC* entre el panel lateral y las props/clases CSS del componente.

### C. Admin Web (`admin-forge`)
*   **Rol:** La consola central de B2B Management.
*   **Stack:** Next.js o React/Vite (en un dominio corporativo abstracto).
*   **Responsabilidades:** Tablero de mandos exclusivo para "Master Admins" donde visualizar métricas de adopción (*Seats*), habilitar repositorios concretos o suspender acceso a las suites Desktop locales ante impagos o brechas.

### D. Backend Cloud (`forge-functions`)
*   **Rol:** El puente de autoridad transaccional y validación (Trust Layer).
*   **Stack:** Firebase Cloud Functions + Firestore Data Rules + Stripe Node SDK.
*   **Responsabilidades:** Prevenir inicios de sesión fraudulentos. Gestionar las transacciones financieras recurrentes (Webhooks) y dictar, mediante tokens de autenticación firmados, si la *Desktop App* instalada localmente tiene permisos de iniciar su "Render Engine" o está revocada.

---

## 2. Casos de Uso Core (User Journeys Reales)

El valor del Editor no es abstracto, se traduce en cuatro flujos de trabajo de clase mundial:

1.  **"El Ajuste de Spacing Sin Terminal" (Product Manager):** El PM detecta que los márgenes de un *Hero Banner* están mal en Producción. Abre UI Forge, selecciona el componente de "Banner", sube un input visual de `padding` de 16px a 32px. Su alteración reescribe el CSS-Module, da *Guardar* e inmediatamente se genera un *Pull Request* listísimo para revisión técnica, sin abrir VSCode.
2.  **"Auditoría Visual Global" (Lead Designer):** El diseñador líder carga toda la carpeta de de *Modales* del proyecto para inspeccionar el *Design System*. Selecciona las cuatro variantes (Hover, Disabled, Error) del panel, y ajusta en serie los colores globales que se reflejan de vuelta en el AST hacia la rama de corrección.
3.  **"Protección Anti-Rotura" (Desarrollador React):** Un ingeniero Junior arranca en el proyecto. Su empresa instala UI Forge que utiliza el `forgecore-template.json`. Las opciones del Prop Panel lo obligan a elegir entre `"primary" | "secondary"` para un botón. El motor **impide estrictamente** que el junior ponga `"red"`, forzando el acoplamiento corporativo del Design System antes del escrutinio (Pre-Commit Linter Enforced).

---

## 3. Limitaciones Actuales y Restricciones Conocidas (v1.0)

Para mantener la integridad arquitectónica, ciertas concesiones deben documentarse en la fase técnica actual:
1.  **Motor AST Pendiente de Profundidad:** El analizador actual sobrescribe eficientemente strings, props booleanas y variables CSS/CSS Modules en capas llanas. Sin embargo, transformaciones complejas de anidamiento profundo de componentes (Drag & Drop estructural entre el *Children* A y el *Children* B dentro de un JSX iterativo complicado) está vetado para asegurar que no se corrompen bucles `array.map()` puros.
2.  **Infraestructura de Pagos en Vuelo:** Las integraciones del SDK de facturación B2B complejo (`stripeService.ts`) que atan facturación tipo *Usage-Based* (Cobro-por-Commit) a la limitación de la CPU local están en *Beta* y requieren validación.

---

## 4. Roadmap Oficial de Ingeniería (Versiones)

El trazado desde el MVP técnico a la infraestructura global:

*   **v1.0 (Foundation & Sandboxing - Q1/Q2 2026):**
    *   Motor IPC Sandboxed 100% estable validado en producción (GenDS).
    *   Integración Git Push/Pull y Branching segura.
    *   Hot-Reload bidireccional de CSS Custom Properties (`styleOverrides`).
*   **v1.5 (B2B SaaS Checkout & Security - Q3 2026):**
    *   RBAC Estricto activado por Firestore Validation Rules.
    *   Landing Web + Checkout Stripe + Auto-Provisioning de App Desktop.
    *   Compatibilidad profunda en canvas con Portals de React y Modales.
*   **v2.0 (The Generative & Deep Editor - Q4 2026 / Q1 2027):**
    *   Drag and Drop Estrutuctural Reactivo (AST Manipulation Compleja).
    *   Integración AI-Style Prompting (AST Aware AI Engine).
    *   Lazy Parsing para escalar en Monorepos Enterprise inmensos.
*   **v3.0 (The Collaborative Network - Q2/Q3 2027):**
    *   Figma-like Presence en el Canvas Local para visualización en vivo de equipo.
    *   Gestores asíncronos en componentes con comentarios amarrados al Pull Request.
    *   Plugins API Open Source para soporte Svelte/VueJS.
