# Documento de Propiedad Intelectual, Titularidad e Independencia (UI Forge)

**FECHA DE ELABORACIÓN:** 25 de Febrero de 2026

Este documento establece el marco de titularidad material, intelectual e industrial sobre el desarrollo de la infraestructura de software denominada **"UI Forge"** (incluyendo sus microservicios asociados `admin-forge`, `forge-functions`, `ui-forge-web` y la aplicación desktop principal en Electron).

---

## 1. Declaración de Autoría e Independencia de Recursos

Mediante el presente documento se certifica lo siguiente:

1.  **Autoría Material:** Todo el ecosistema de código base que conforma "UI Forge" ha sido conceptualizado, arquitectado y escrito íntegramente por su autor/fundador (Santferal), actuando a título personal.
2.  **Desvinculación Temporal:** El desarrollo del código fuente, arquitectura (AST Parsers, Iframe Sandboxing, CLI Integrations) y diseño de la aplicación se ha realizado exclusiva y estrictamente **fuera del horario laboral** y de las responsabilidades contractuales que el autor pudiera mantener con terceras partes o empresas empleadoras en el momento de la creación.
3.  **Desvinculación Material:** No se ha utilizado **ningún recurso físico, lógico ni económico** propiedad de terceras partes o empresas empleadoras para el desarrollo de esta herramienta. Esto incluye, pero no se limita a:
    *   Equipos informáticos corporativos (Laptops, Servidores).
    *   Licencias de Software pagadas por terceros (Suscripciones IDE, Figma, GitHub Copilot).
    *   Infraestructuras Cloud pagadas por terceros (Vercel, AWS, Firebase, Stripe). Todo el stack ha sido provisionado mediante cuentas personales del autor.
4.  **No Infracción de Acuerdos Previos:** El motor conceptual de UI Forge no es un producto derivado del software interno, negocio o producto final de ninguna empresa empleadora presente o pasada del autor. Su naturaleza es puramente de herramienta de ingeniería universal y agnóstica (*Developer Tooling*), que no compite bajo ningún escenario con el objeto comercial de empleadores actuales vinculados al autor.

## 2. Mapa de Propiedad Intelectual y Patentes Tecnológicas (El "Core Engine" Exclusivo)

El valor del ecosistema UI Forge reside en el *Know-How* específico y la abstracción tecnológica desarrollada desde cero. Lo siguiente se declara como **Propiedad Intelectual Privada y Proprietaria (Closed Source):**

1.  **El 'RepoParser' Bidireccional:** El algoritmo léxico y de análisis del AST (*Abstract Syntax Tree*) capaz de leer metadatos de TypeScript nativo, transformarlos en un Universal Properties Panel en memoria, y re-inyectarlos sintácticamente como parches a las Custom Properties de CSS sin mutilar el documento original del usuario.
2.  **Arquitectura de Sandboxing No-Destructiva:** El sistema de comunicación *Iframe IPC (Inter-Process Communication)* diseñado específicamente para evadir la colisión de estilos globales (Leakage) que permite incrustar componentes React en bruto mediante emulación del framework Vite dentro de una cáscara Electron controlada.
3.  **Esquema de Reglas `forgecore-template.json`:** La arquitectura de formato y validación que crea un estándar para que Componentes de UI arbitrarios se adapten estandarizadamente a editores visuales agnósticos.
4.  **Security Governance B2B:** La infraestructura Firebase Middleware (`forge-functions` y Security Firestore Rules) creada específicamente para orquestar la revocación automatizada y control de suscripciones multiseat en herramientas Desktop vinculadas a Stripe.

## 3. Uso de Librerías y Dependencias de Código Abierto (Open Source Audit)

Para constancia de posibles procesos de Due Diligence técnica y validación (*Acqui-hire*), UI Forge hace uso de tecnologías de terceros estrictamente bajo licencias permisivas (MIT, Apache 2.0).
El código base original y patentable reside en **cómo** estas piezas son orquestadas:

*   **Electron:** Empaquetado Desktop (*MIT License*).
*   **Vite / Esbuild:** Motor de empaquetado y hot-reload para el Sandbox IPC (*MIT License*).
*   **React:** Renderizado de la Shell y el Componente Guest (*MIT License*).
*   **Firebase / Stripe SDKs:** Middleware transaccional y validación Cloud (*Apache / MIT*).

*(Nota Legal: El presente documento refuerza la trazabilidad histórica de los repositorios privados originales guardados en la cuenta personal GitHub del autor, que demuestran la cadena ininterrumpida de commits en días no laborales / horarios nocturnos a lo largo de los sprints de creación del software).*
