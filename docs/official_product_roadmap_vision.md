# Visionary Product Roadmap: El Ecosistema UI Forge

Este documento es el **Mapa de Ruta a Nivel de Producto**, diseñado no desde una óptica exclusivamente técnica, sino desde la **expansión de valor funcional masivo**. Proyecta el estado actual (Lo Conseguido) y la visión definitiva ("A lo que llegará a ser") a través de los tres grandes nodos del ecosistema: `ui-forge` (Desktop Editor), `admin-forge` (B2B Control Panel) y `ui-forge-web` (GTM Landing & Portal).

---

## 🏛️ PARTE 1: La Fundación Actual (Lo Conseguido)

El hito fundamental de UI Forge ha sido **superar el abismo del Sandboxing**, logrando demostrar que es posible alterar visualmente un código de React en bruto sin corromperlo.

### 1. UI Forge (The Desktop Editor)
*   **Aislamiento IPC (Cero Colisiones CSS):** Logro arquitectónico donde los estilos del editor no contaminan los estilos del componente corporativo en renderizado.
*   **"Code is Truth" Parser:** Lectura y sobreescritura bidireccional de CSS Modules y Custom Tokens en memoria sin destruir el AST original.
*   **Integración Git "Zero-Terminal":** Capacidad actual de clonar, crear ramas de trabajo aisladas, comitear y pushear los cambios de diseño sin tocar una línea de comandos.
*   **Prop Panel Auto-Generado:** Lectura pasiva de TypeScript para inyectar un panel visual (Toggles, Inputs) en tiempo real, agnóstico al Design System (vía `forgecore`).

### 2. Admin Forge (The Master Dashboard)
*   **Gestión RBAC Nativa:** Sistema de autenticación de niveles (Firebase) que discrimina entre Master Admins y usuarios estándar.
*   **Security Firestore Enforced:** Las reglas de la nube bloquean desde el origen que un usuario sin acceso pueda siquiera encender el renderizador local.

### 3. UI Forge Web (The Go-To-Market Face)
*   **Plataforma de Descarga Autenticada:** Puerta de enlace segura con Firebase Auth para el registro, cualificación de Leads y distribución del ejecutable binario firmado de Electron.

---

## 🚀 PARTE 2: La Visión de Dominio Absoluto (El Ecosistema Futuro)

Para convertirse en el Sistema Operativo por defecto de cualquier equipo de producto, las funcionalidades futuras deben transformar UI Forge de un "Editor Visual" a un "Orquestador de Trabajo de Equipo e Inteligencia Artificial".

### 1. El Futuro de UI Forge (Desktop IDE)
*El arma letal que los diseñadores usarán en lugar del IDE de terminal.*

**A. Edición Profunda y Estructural (Deep Editor)**
*   **AST Drag & Drop Visual:** Reestructuración de componentes complejos (mover un `div` dentro de otro `div`) de forma visual pero respetando los hooks nativos de React.
*   **Edición Multi-Variante en Lienzo Infinito:** Visualizar al mismo tiempo el `Hover`, `Active` y `Disabled` de un componente en una pizarra, y editarlos sincrónicamente (cambias la sombra base y aplica a todos).
*   **Auto-Ajuste de Media Queries Inteligente:** Simuladores de resoluciones (Móvil, Tablet) integrados que, al desplazar un tirador visual, generan automáticamente los breakpoints CSS responsivos correctos en tu archivo CSS.

**B. Conectividad y Colaboración Asíncrona**
*   **Sincronización Jira / Linear Bilateral:** Enlazar tu sesión visual a un ticket de Jira. Al darle "Hacer Pull Request", el estado del ticket en Atlassian pasa automáticamente a "Code Review".
*   **Figma Live Presence (Realtime Triage):** Ver los cursores multicolores de tus compañeros sobrevolando el código renderizado para entender qué tokens están manipulando.
*   **Pins Contextuales de Git:** Poder "post-itear" la interfaz con un comentario sobre un padding excesivo, y que ese comentario viaje anexado como metadato al Pull Request en GitHub.
*   **Exportación de Documentación a PDF/Storybook:** Un generador en un clic que lee todos los cambios y exporta un informe limpio detallando "Variables Modificadas", perfecto para entregar la revisión de diseño a clientes no-técnicos.

**C. La Capa de Agentes de IA Conscientes (Context-Aware AI)**
*   **Style Prompting Preciso:** Pides *"Ajusta esto a diseño oscuro"* y la IA no escribe código nuevo; ejecuta comandos puros contra tus componentes de librería existentes forzando tus Toggles de tema.
*   **Extracción Abstraccional Automática:** Si la IA detecta un archivo de 2,000 líneas con 10 botones idénticos hardcodeados, propondrá extraer un `<MasterButton>` y refactorizar todo el archivo React visualmente antes de comitear.
*   **QA Bot (QA Testing en Vivo):** Un escáner en paralelo que simula cientos de resoluciones en milisegundos y muestra una alerta roja si el texto de tu rediseño se solapa/rompe en pantallas del iPhone SE.

### 2. El Futuro del Admin Forge (Management & Enterprise Scale)
*El cerebro donde los CTOs y Líderes de Diseño supervisan el cumplimiento (Compliance) del equipo.*

**A. Analítica y Deuda Estética**
*   **Global Design System Audit:** Un dashboard que escanea cíclicamente los repositorios del equipo y da una nota sobre 100 de "salud". Mostrando un reporte de cuántos colores han sido "hardcodeados" manualmente ignorando las guías oficiales.
*   **Analíticas de Uso B2B (Métricas de Asientos):** Reportes exactos de cuántos Commits han generado tus diseñadores desde UI Forge versus desde un editor de texto convencional, evidenciando el ROI comercial.

**B. Gobernabilidad (Governance & Compliance)**
*   **SSO Corporativo Nativo:** Integración "Plug and Play" con Okta y Azure AD para aprovisionar agencias de más de 500 diseñadores con 1 click.
*   **Master Linter Visual:** Inyección de reglas restrictivas dictaminadas por el Jefe de Diseño: "Ningún botón corporativo puede tener bordes redondeados (Border Radius = 0)". UI Forge bloqueará ese campo visual en los escritorios de todos los empleados de la organización.
*   **Flujo de Aprobación Condicional de Commits:** Posibilidad de configurar que los "Juniors" creen los cambios visuales, pero el botón de Push genere primero un "Ticket de Confirmación Admin" dentro del panel en la nube.

### 3. El Futuro de UI Forge Web (GTM, Facturación y Onboarding)
*El embudo perfecto de ventas e integración Zero-Touch.*

*   **Facturación Tierizada Automática (Stripe Deep Integration):** Self-Service para agencias (SaaS). Que un manager pase su tarjeta, compre "5 Asientos Pro" y auto-gestione las altas/bajas de su propia plantilla sin contactar a ventas.
*   **Cloud Demo Sandboxes:** En vez de obligarlos a instalar Desktop, habilitar un mini-entorno renderizado hiper-limitado en el navegador (WebContainer / StackBlitz API) anidado en la Landing Page, para que los leads cambien el color de un botón y sientan la magia del "Código es Verdad" en 5 segundos.
*   **Generador Interactivo de `forgecore-template.json`:** Un *Wizard* asistido en la web donde un desarrollador pega su código Typescript (ej. su botón maestro), y la Web le autogenera el estándar JSON de abstracción visual de UI Forge para que lo exporte, eliminando toda la fricción de adopción del estándar técnico empresarial.

---
*UI Forge no persigue el nicho de "ayudar a los diseñadores", aspira al Océano Azul estructural: Ser el Sistema Operativo absoluto que une de manera bi-direccional la concepción visual de las agencias de diseño web con las tripas reales de ingeniería de software.*
