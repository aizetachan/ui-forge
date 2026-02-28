# Proyecto UI Forge

Este documento proporciona una visión general del proyecto **UI Forge**, su ecosistema, arquitectura, estado actual y propuesta de valor.

## Descripción Funcional

**UI Forge** es un entorno de desarrollo visual de escritorio (basado en Electron y React) diseñado para editar y gestionar componentes de UI directamente desde su código fuente. Permite a diseñadores y desarrolladores conectar repositorios Git externos (o locales), analizar el código base para entender su estructura (propiedades y estilos) y renderizar componentes individuales o páginas en un entorno aislado y seguro (Sandbox).

A través de un "Panel de Propiedades Universal", los usuarios pueden alterar interactivamente estilos (mediante CSS Modules y variables CSS), contenido y propiedades de los componentes. Al finalizar los cambios, la herramienta no exporta un código generado ad-hoc desde cero, sino que realiza modificaciones controladas sobre el código React/CSS original y sincroniza los cambios de vuelta al repositorio generando commits (Push/Pull de Git).

Su objetivo principal es habilitar la `Single Source of Truth` (Única Fuente de Verdad) basada puramente en el ecosistema real del código de producción de frontend, eliminando la duplicidad entre herramientas de diseño vectoriales y el repositorio de código.

---

## Roadmap

Aunque el proyecto se encuentra en constante iteración, el **Roadmap general** comprende las siguientes fases clave:

1. **Fase 1: Motor Base y Ecosistema (Completado):** 
   - Renderizado seguro usando iframe IPC Sandbox.
   - Parseo de metadata y estilos de componentes (RepoParser).
   - Control de versiones y Git local embebido.
2. **Fase 2: Interfaz e Identidad de Usuario (En progreso):** 
   - Sistema de membresía y niveles de acceso (Firebase RBAC, Cloud Functions).
   - Subscripciones y pasarelas de pago (`stripeService.ts` en activo).
   - Separación formal entre aplicación de cliente de edición (Desktop) y aplicación web administrativa (Admin Forge).
3. **Fase 3: Expansión de Capacidad de Edición Visual:**
   - Soporte profundo a reestructuraciones del AST (Abstract Syntax Tree) para Drag and Drop de estructura de componentes, no sólo de sus estilos o propiedades lineales.
   - Pre-visualización de interacciones complejas en el canvas (animaciones vinculadas por estado).
4. **Fase 4: Ecosistema Online y Colaborativo:**
   - Presence System en tiempo real (comentarios asíncronos y presencia de múltiples usuarios en el mismo componente).
   - Integración nativa con pipelines CI/CD y automatización de despliegue tras cada PR generado desde la interfaz visual.

---

## Arquitectura

El ecosistema está estructurado como un proyecto modular e interconectado, priorizando escalabilidad comercial y técnica. Recientemente particionado en repositorios dedicados para mejor mantenimiento:

1. **UI Forge (Desktop App):**
   - **Frontend Framework:** React + Vite encapsulado en Electron para acceso a sistema de archivos local (para Git y lectura de carpetas abstractas).
   - **Sandbox IPC:** Arquitectura de renderizado desacoplada. Los componentes de diseño (ej. *GenDS*) se montan y previsualizan de manera segura en un Iframe aislado, previniendo colisión de estilos y dependencias con la propia UI administrativa del editor.
   - **Motor CSS/Variables:** Usa `cssModuleParser` y `styleOverrides` interactivos que permiten alteración de hojas de estilo (.module.css) reflejables instantáneamente en la interfaz en vivo.
2. **Admin Forge (Web App):**
   - Dashboard web de control separado del entorno de edición, destinado a "Master Admins" para la gestión integral del dominio, ciclos de vida de clientes, consumo de créditos y habilitación de usuarios (Pending vs Approved).
3. **Forge Functions (Backend):**
   - Cloud Functions de Firebase actuando como un Gateway de confianza para lógica sensible: asignación inicial de roles, webhooks de Stripe, gestión de estado de suscripción y límites de recursos en tiempo real.
4. **Infraestructura de Datos & Auth:**
   - Firestore (con Security Rules avanzadas) rige el acceso, metadatos de usuario (Role-Based Access Control) y sincronización. 
   - Firebase Auth para inicio de sesión unificado multiplataforma en el ecosistema (GitHub, Google Docs, Email).

---

## Qué está Desarrollado y Qué no

### ✅ Desarrollado
- **Contenedor Principal Desktop:** Aplicación Electron (empaquetado e instaladores disponibles) con integración React + Vite.
- **Git Sync Engine:** Integración de comandos Git mediante procesos locales, resolviendo ramas desvinculadas (upstream/downstream) y clonado de repos.
- **Pipeline Visual (Editor):** Flujo real de Universal Properties Panel conectado por directivas (`useStyleOverrides`) capaz de exponer opciones de diseño (CSS variables/modulos) para un componente dado y hacer hot-reload.
- **Acceso & Autenticación:** Firebase SDK configurado; reglas de Firestore estrictas activadas con segregación de roles de administrador primario.
- **Segregación Estructural:** Monorepo original fracturado orgánicamente en `ui-forge`, `admin-forge` y servicios backend dedicados para un flujo de equipo más ordenado.
- **Integración de Componentes GenDS:** Extracción robusta de las especificaciones v1.1 vía `forgecore-template.json`. Componentes base y soporte a Overlays (Portals).

### ⏳ Pendiente / En Desarrollo
- **Suscripciones Globales Comerciales:** La integración de la capa de Stripe está actualmente siendo desplegada (`stripeService.ts`) para flujos de pago B2B reales.
- **Drag & Drop Estructural Profundo:** Modificar dependencias jerárquicas muy complejas a un nivel de edición no destructivo del AST de TSX/JSX completo de extremo a extremo.
- **Consolidación Admin Forge Final:** Llevar las funcionalidades Web a un plano robusto de control unificado, más allá de la gestión por consola Firebase base de roles y control crudo de base de datos.
- **Extensibilidad (Plugins):** Un sistema planeado para permitir a las empresas inyectar reglas de linter y validación exclusivas de la compañía dentro de `UI Forge` de manera dinámica.

---

## Valor Diferencial

Frente a herramientas visuales estandarizadas (como *Figma*, *Penpot*, *Storybook*, o plataformas No-Code / Low-Code), UI Forge posee una filosofía radicalmente diferente:

1. **"Code is Truth" (El Código es la Única Verdad):**
   Herramientas Low-Code exportan su propio formato intermedio que genera inestabilidad cuando el desarrollador tradicional interactúa con él. Herramientas de diseño clásicas jamás entran al servidor de producción. UI Forge **lee y escribe directamente tu repositorio real de React**. El entregable de UI Forge es un PR a GitHub perfectamente visible en tu IDE estándar.
2. **Respeto a la Estructura Organizacional:**
   Al trabajar con metadatos y AST de TypeScript de modo no destructivo, la herramienta es capaz de leer las convenciones del usuario (como CSS Modules o utilidades específicas) y alterarlo sin sobrescribir o malograr las clases existentes u otras inyecciones de código.
3. **Flujo Cero Fricción para Equipos de Producto:**
   Destruye la barrera de transferencia de diseño a implementación. Un Project Manager o Diseñador de producto puede cambiar márgenes, tipografías y variables de diseño dentro de componentes funcionalmente vivos (enlazados a bases de datos y hooks reales de contexto), sin desestabilizar la lógica técnica escrita por los ingenieros.
4. **Sandbox de Interacción Completa:**
   No se trabaja sobre "mockups", sino sobre el Runtime real de los componentes en la vida real, procesando de manera transparente colisiones de alcance mediante aislamiento local (IFrame Contexting), lo que lo diferencia brutalmente de editores estáticos.

---

## Estimación de Valor Económico y Coste de Desarrollo

Para comprender el coste real de una herramienta de ingeniería de esta magnitud (si fuese desarrollada por una agencia externa o un equipo corporativo dedicado) y su posterior valoración de mercado, se detalla la siguiente estimación basada en horas de Ingeniería de Software (SWE) y tarifas promedio de mercado internacional (Estados Unidos y Europa):

### 1. Coste de Construcción (Sunk Cost)

Esta estimación asume la creación de la arquitectura actual desde cero: Motores de Análisis AST, UI Cliente, Backend Serverless e integraciones DevOps.

* **Desarrollo Frontend & Motor Electron (500 - 700 horas):**
  - *Alcance:* Creación del Sandbox IPC React/Vite/Electron, desarrollo del Git Engine local, parseador de metadatos/AST (`RepoParser`) e interfaz gráfica principal.
  - *Perfil:* Senior Frontend/Node.js Engineer ($60 - $100 / hr).
  - *Coste Estimado:* **$30,000 - $70,000 USD**
* **Desarrollo Backend & Cloud (200 - 300 horas):**
  - *Alcance:* Arquitectura Serverless en Firebase (Cloud Functions, Firestore Security Rules), Stripe webhooks, Panel Admin (Admin Forge), Auth y control de RBAC.
  - *Perfil:* Cloud/Backend Engineer ($60 - $90 / hr).
  - *Coste Estimado:* **$12,000 - $27,000 USD**
* **Diseño UX/UI & Arquitectura (150 - 250 horas):**
  - *Alcance:* Conceptualización de flujos de usuario, diseño de sistema base (`GenDS`), arquitectura conceptual y experiencia de usuario.
  - *Perfil:* Product Designer / Architect ($70 - $120 / hr).
  - *Coste Estimado:* **$10,500 - $30,000 USD**
* **QA, Automatización & DevOps (100 - 150 horas):**
  - *Alcance:* Configuración de pipelines, empaquetado seguro y firmado en múltiples plataformas (Electron Builder) entorno local/producción.
  - *Coste Estimado:* **$5,000 - $12,000 USD**

**Coste Total de Desarrollo (Agencia / In-house): ~$57,500 – $139,000 USD** *(Media aritmética de **~$98,000 USD**).*

### 2. Valoración Comercial e IP (Propiedad Intelectual)

El valor del producto *no es solo lo que costó hacerlo*, sino la barrera tecnológica de entrada (foso/moat) que consolida:

* **Patrimonio Tecnológico (IP):** El motor interno ("Single Source of Truth") para enlazar un editor visual directamente con código Node.js/React local y aplicar modificaciones modulares generativas tiene gran demanda. Desarrollar este *Know-How* avanzado justifica por sí solo **una valoración basal de $100,000 a $250,000 USD** como IP tecnológica o "Acqui-hire" (adquisición estratégica) para empresas tipo Vercel, Netlify o grandes agencias, incluso en etapas pre-ingreso.
* **Posicionamiento SaaS Institucional:** UI Forge captura bolsas de presupuesto corporativo destinadas a (A) Licencias Enterprise de diseño y (B) Horas de ingeniería dedicadas a "traducir" diseños a código inamovible. Al introducir un flujo de cobro B2B recurrente, el multiplicador en rondas de valoración privada para herramientas "DevTools SaaS" altamente retentivas suele escalar entre **5x y 10x los Ingresos Anuales (ARR)**.

### 3. Total de la Aplicación (Opciones de Valoración)

El "Total de la App" variará drásticamente dependiendo del enfoque de adquisición o el tipo de equipo contratado para su creación. A continuación, se desglosan 3 escenarios reales:

---

#### 📌 Opción A: "Low-Cost" / Offshore MVP
*Si se hubiera externalizado el desarrollo a agencias offshore (India, Europa del Este, LATAM) priorizando solo que "funcione", sin un Sistema de Diseño maduro ni arquitectura estricta.*

*   **Equipo:** 1-2 Full-Stacks (Tarifa: $25 - $40/hr).
*   **Horas estimadas:** ~600 horas.
*   **Desglose:**
    *   Setup Electron & React: $4,000
    *   Motor Sandbox IPC: $6,000
    *   Integración Git/Parser Básica: $7,000
    *   Backend/Auth (Firebase): $3,000
    *   Integración GenDS / UI simplificada: $3,000
    *   QA Básico: $2,000
*   **Total App (Coste Desarrollo Real): $25,000 - $35,000 USD**
*   *Nota:* Este código probablemente técnica de "caja negra" requeriría una reescritura total si el proyecto escala comercialmente. El IP no vale mucho.

---

#### 📌 Opción B: "Market Standard" / In-House Startup (Escenario Actual)
*El nivel de ingeniería real de la app hoy: Código modular, TypeScript estricto, abstracción para GenDS, Hot-Reload nativo e integraciones robustas (Stripe/Firebase).*

*   **Equipo:** 1 Arquitecto Frontend Senior + 1 Cloud DevOps (Tarifa: $60 - $100/hr en USA/EU).
*   **Horas estimadas:** ~1,000 - 1,200 horas (Diseño + Arquitectura + Código + QA).
*   **Desglose:**
    *   Core Engine (RepoParser, Git Sync, IPC Sandbox): $45,000
    *   Infraestructura Admin & Cloud (RBAC, Webhooks): $20,000
    *   Ecosistema GenDS (Diseño e integraciones UI): $20,000
    *   DevOps (Empaquetado, pipelines): $10,000
*   **Total App (Coste Reemplazo del Software): $85,000 - $110,000 USD**
*   *Nota:* Este es el valor del "Software Sunk Cost", lo que costaría volver a programarlo línea por línea mañana.

---

#### 📌 Opción C: "Premium / IP Value" (Valor de Venta Comercial)
*Si la app se intentase vender hoy mismo a una empresa SaaS o se buscase inversión Seed como producto comercial. Aquí se tasa la Propiedad Intelectual, el foso tecnológico y la tracción arquitectónica.*

*   **Foso Tecnológico (Motor AST/Componentes visuales):** $150,000
    *   *Desarrollar parsers react/css en tiempo real sin destruir el git original es extremadamente nicho y valioso.*
*   **Infraestructura de Pagos y Admin lista para B2B:** $40,000
*   **Marca y Sistema de Diseño (UI-Forge + GenDS):** $30,000
*   **Total App (Valoración IP Comercial Mínima): $220,000 - $300,000+ USD**
*   *Nota:* Empresas como Vercel pagan estos montos solo para adquirir la tecnología y el equipo (Acqui-hire), incluso si el producto aún no tiene clientes pagando.
