# Arquitectura Técnica Formal (UI Forge)

Este documento detalla la estructura técnica fundacional de UI Forge, sus nodos principales de ejecución, y los diagramas conceptuales que permiten a la aplicación integrarse de forma no-destructiva en entornos empresariales.

---

## 1. Diagrama de Arquitectura Global

UI Forge sigue un modelo "Local-First / Server-Verified", separando el procesamiento pesado del renderizado en la máquina del usuario, y la validación comercial en la nube.

```text
[ ENTORNO LOCAL CLIENTE (Electron) ]
       │
       ├──> Main Process (Node.js)
       │    ├── File System Access (fs) -> Lee repositorios React/Vite.
       │    ├── Native Git Wrapper -> Ramas, Clonado, Pull/Push.
       │    └── AST Parser Engine -> Construcción del 'forgecore-template.json'.
       │
       ├──> Renderer Process (Vite + React)
            ├── UI Editor (Gestión de Estado, Prop Panel, Canvas Shell)
            └── Sandbox `<iframe>` IPC
                 └── Componente React renderizado (El "Subject" bajo edición).
                      ^
[ CONEXIÓN DE SEGURIDAD Y TRANSACCIONES ]     
                      v
[ ENTORNO CLOUD CENTRALIZADO (Firebase / Stripe) ]
       │
       ├──> Firebase Auth -> Identidad corporativa (OAuth).
       ├──> Cloud Firestore -> RBAC (Role-Based Access Control) y Gestión de Tiers.
       ├──> Cloud Functions -> Serverless endpoints para operaciones seguras (ej. Stripe Webhooks).
       └──> Panel de Administración (`admin-forge` Next.js/React Web).
```

## 2. Diagrama Sandbox e Iframe IPC (Inter-Process Communication)

El núcleo tecnológico (*Moat*) reside en cómo garantizamos que los estilos del contenedor (UI Forge) no machacan los estilos del botón o modal importado del usuario.

*   **El Host (UI Forge):** Ejecuta la UI del editor y almacena los `styleOverrides` temporales (ej. la variable CSS `--button-bg` ha cambiado a `#000`).
*   **El Guest (Iframe React):** Arranca una sub-instancia limpia de React sobre un puerto libre local de Vite. No carga ningún CSS del editor.
*   **El Puente (postMessage API):** El Host envía un payload JSON: `{ type: 'INJECT_STYLES', payload: { '--button-bg': '#000' } }`. El Guest intercepta el mensaje e inyecta dinámicamente el override en la etiqueta `<style>` raíz del componente renderizado. Este flujo dura menos de 10 milisegundos, dando sensación de Hot-Reload visual instantáneo, pero manteniendo aislamiento de memoria y de CSS perfecto.

## 3. Modelo de Datos y Seguridad (RBAC Firestore)

La base de datos en GCP/Firestore no guarda el código de las empresas. Su modelo de datos está modelado estrictamente en torno a permisos y validación B2B.

**Estructura de la Colección de `users`:**
```json
{
  "uid": "abc123xyz",
  "email": "dev@enterprise.com",
  "role": "master_admin" | "admin" | "editor" | "pending",
  "tier": "free" | "pro" | "enterprise",
  "stripeCustomerId": "cus_92384923nvd9",
  "subscriptionStatus": "active" | "past_due" | "canceled",
  "createdAt": "Timestamp",
  "lastLoginAt": "Timestamp"
}
```

**Security Rules (Firestore):**
Las reglas bloquean radicalmente el acceso de la Desktop App al panel de edición si el `role` es `"pending"` o el `subscriptionStatus` refleja un pago fallido. Esto garantiza una capa DRM fortísima para herramientas B2B.

```javascript
match /users/{userId} {
  // Sólo el propio usuario o un master_admin puede leer.
  allow read: if isOwner(userId) || isMasterAdmin();
  // NADIE puede auto-elevar su propio rol desde el frontend.
  allow write: if isOwner(userId) && (!request.resource.data.keys().hasAny(['role', 'tier']));
  // Master admins tienen control total de aprovisionamiento de agencia.
  allow update: if isMasterAdmin();
}
```

## 4. Flujo Git (Push/Pull Lifecycle) y No-Destrucción

UI Forge impone un esquema restrictivo (*Opinionated Workflow*) para asegurar que el código fuente de los desarrolladores nunca se corrompe por clicks de diseño.

1.  **Bloqueo Main/Master:** El software detecta si `HEAD` apunta a una rama de producción. Si es así, **desactiva visualmente** el botón de editar.
2.  **Derivación Obligatoria:** Obliga a crear o cambiar a una rama de trabajo (ej. `design-update-header`).
3.  **AST Patching (Memory to Disk):** Cuando el usuario le da a "Guardar" en el Prop Panel, el parser lee el archivo `.module.css` y reemplaza léxicamente sólo los valores de los *Custom properties* (Tokens) que fueron manipulados en memoria.
4.  **Generación de PR:** UI Forge agrupa todos los archivos sucios (CSS, TSX), realiza `git add .`, consolida un commit normalizado (ej. `[UI-FORGE]: Updated Layout spacings and primary variables`) y dispara `git push`.
5.  **Cierre de Ciclo:** El desarrollador recibe en Github un PR visualmente revisable y completamente integrado en su *Pipeline* de CI/CD. No se manda código de UI Forge, se mandan líneas de CSS/TSX nativas del repositorio del cliente.
