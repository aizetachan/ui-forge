# UI Forge: Product Vision Document

## 1. ¿Qué es UI Forge?
UI Forge es un entorno de desarrollo interactivo (IDE Visual) de escritorio diseñado para editar, estructurar y estilar componentes de React en tiempo real directamente sobre el código fuente de un repositorio. No es una herramienta de dibujo vectorial que genera código exportable, sino un "compilador visual bidireccional" que procesa ramas de Git y genera *Pull Requests* funcionales asimilando el 100% del ecosistema técnico del usuario.

## 2. ¿Por qué existe? (El Problema Estructural)
La industria del software sufre de una fricción sistémica conocida como el "Handoff Design-to-Code". Las herramientas de diseño actuales (Figma, Penpot) viven en un universo paralelo de píxeles y vectores que desconoce las restricciones de un repositorio (Design Tokens, variables CSS, dependencias React, linters y lógica de estado). 
Esto genera:
- Doble esfuerzo (Diseñar en vector -> Programar en código).
- Pérdida de sincronía (El diseño rápido queda obsoleto frente al código de producción).
- Código basura (Las plataformas *Low-Code* exportan código autogenerado inamovible que los ingenieros se niegan a mantener).

## 3. ¿Qué cambia en la industria?
UI Forge introduce un paradigma radical: **"Code is Truth"** (El Código es la Única Verdad).
Con Forge, el repositorio local de GitHub *es* el archivo de diseño. La herramienta elimina la fase de "exportación" al permitir a diseñadores y Product Managers interactuar visualmente con el componente real que ya está programado, modificando su CSS, sus variables espaciales o sus propiedades (props), sin corromper la arquitectura, y devolviendo el trabajo directamente a la canalización continua (CI/CD) de los desarrolladores.

## 4. Diferenciador Radical (El "Moat")
A diferencia de Webflow, Framer o Builder.io, UI Forge **NO impone su propio framework ni su propio almacenamiento en la nube**.
UI Forge es *agnóstico y respetuoso*:
1. **Single Source of Truth:** Lee tu código abstracto (AST) y tus tokens `.module.css` vivos, sin obligarte a reconstruirlos desde cero en un Dashboard en la nube.
2. **Local-First & Seguro:** El código fuente propietario nunca abandona la máquina del desarrollador/agencia.
3. **Sandbox Runtime Real:** El lienzo visual no pinta un "mockup", ejecuta el componente interactivo de React en vivo procesando todas sus complejidades (Portals, condicionales, llamadas falsas a red). 
4. **Respeto Organizacional:** Entregable garantizado vía *Pull Request*. Los ingenieros aprueban los cambios de diseño igual que un cambio de arquitectura, sin pisar la lógica de negocio subyacente de la aplicación.
