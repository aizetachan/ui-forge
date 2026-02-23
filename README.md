<p align="center">
  <img src="public/logouiforge.svg" alt="UI Forge Logo" width="64" height="64" />
</p>

<h1 align="center">UI Forge</h1>

<p align="center">
  <strong>A desktop application for visually inspecting, editing, and managing design-system components in real time.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-40+-47848F?logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/esbuild--wasm-0.27-FFCF00?logo=esbuild&logoColor=black" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration: forgecore.json](#configuration-forgecorejson)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)

---

## Overview

**UI Forge** is a cross-platform desktop application (macOS, Windows, Linux) that connects to any design-system repository and provides a visual workspace for browsing, previewing, and editing components. It reads a `forgecore.json` configuration file from the repo to understand the component structure, then compiles and renders each component live inside an isolated sandbox — no Storybook required.

Developers and designers can:

- **Browse** all components and design tokens in a structured sidebar.
- **Preview** components in a sandboxed iframe with live CSS rendering.
- **Edit** CSS properties visually and write changes back to the source files.
- **Sync** changes via Git (commit, push, pull) without leaving the app.
- **Chat** with an AI assistant (Gemini) that has full context of your repository.

---

## Key Features

| Feature                       | Description                                                                                    |
| ----------------------------- | -----------------------------------------------------------------------------------------------|
| 🧩 **Component Browser**     | Sidebar listing all components and tokens parsed from `forgecore.json`.                         |
| 🖼️ **Live Preview Sandbox**  | Isolated iframe rendering components with real dependencies compiled via esbuild-wasm.          |
| 🎨 **Visual CSS Editor**     | Properties Panel with categorized CSS sections (Typography, Layout, Appearance, Effects, etc.). |
| 📝 **File Writeback**        | Edit CSS values in the panel → changes are written directly to `.module.css` files.             |
| 🔀 **Variant & Size Picker** | Switch between component variants, sizes, and interactive states (hover, focus, active, etc.).  |
| 🧪 **States Preview**        | Force pseudo-states like `:hover`, `:focus`, `:disabled` on any component.                      |
| 🔗 **Git Integration**       | Clone, pull, commit, push, and check branch status — all from within the app.                   |
| 🤖 **AI Chat (Gemini)**      | Floating chat window powered by Google Gemini with full repo context.                           |
| 🔐 **Firebase Auth**         | Google Sign-In with role-based access control (managed from Admin Forge).                       |
| 📜 **Change History**        | Undo/redo stack tracking all CSS modifications with full change log.                            |
| 🧱 **Sub-element Editing**   | Inspect and edit individual sub-elements within compound components.                            |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        ELECTRON (Main Process)                   │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐                │
│  │ repoParser  │  │ gitService  │  │ astParser  │                │
│  │ Reads repos │  │ Clone/Pull/ │  │ TypeScript │                │
│  │ & forgecore │  │ Push/Commit │  │ AST parsing│                │
│  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘                │
│         │                │               │                       │
│  ┌──────┴──────┐  ┌──────┴──────────────┬┘                       │
│  │ codeWriter  │  │ forgecoreTypes      │                        │
│  │ Write CSS   │  │ Type definitions    │                        │
│  │ back to file│  │ for forgecore.json  │                        │
│  └─────────────┘  └────────────────────-┘                        │
│                                                                  │
│                     IPC Bridge (preload.ts)                      │
├──────────────────────────────────────────────────────────────────┤
│                     RENDERER (React + Vite)                      │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────────┐     │
│  │ App.tsx  │  │   Sidebar    │  │   PropertiesPanel       │     │
│  │ Layout & │  │ Components & │  │ CSS sections, Variants, │     │
│  │ routing  │  │ Token list   │  │ AI chat, Code view      │     │
│  └────┬─────┘  └──────────────┘  └─────────────────────────┘     │
│       │                                                          │
│  ┌────┴──────────────┐  ┌──────────────────────┐                 │
│  │   ReactSandbox    │  │  esbuildCompiler.ts   │                │
│  │ Isolated iframe   │  │ Browser-side WASM     │                │
│  │ renders component │◄─┤ JSX/TSX → JavaScript  │                │
│  └───────────────────┘  └──────────────────────┘                 │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────────┐                  │
│  │ cssModuleParser  │  │  geminiService.ts     │                 │
│  │ Parse & categorize│  │ AI chat with repo    │                 │
│  │ CSS Modules      │  │ context (Gemini API)  │                 │
│  └──────────────────┘  └──────────────────────┘                  │
│                                                                  │
│  Hooks: useAppState │ useAuth │ useChangeHistory                 │
│  Libs:  firebase.ts │ userService.ts │ changeHistory.ts          │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Connect to repo** → Electron's `repoParser` reads `forgecore.json`, scans for components, extracts source code, CSS modules, props, variants, dependencies, and assets.
2. **Compile** → The renderer's `esbuildCompiler` (running esbuild-wasm in the browser) compiles TSX/JSX + dependencies into executable JavaScript.
3. **Render** → `ReactSandbox` loads the compiled code into an isolated iframe with the theme CSS and React runtime.
4. **Edit** → `PropertiesPanel` uses `cssModuleParser` to display categorized CSS properties. Edits trigger writeback via `codeWriter` (Electron IPC) directly to the `.module.css` file.
5. **Sync** → `gitService` manages commits, pushes, and pulls through the Electron main process.

---

## Project Structure

```
ui-forge/
├── electron/                    # Electron main process
│   ├── main.ts                  # Window creation, IPC handlers, protocol registration
│   ├── preload.ts               # Context bridge (exposes IPC to renderer)
│   └── services/
│       ├── repoParser.ts        # Parses forgecore.json and scans repo for components
│       ├── astParser.ts         # TypeScript AST parsing for prop extraction
│       ├── codeWriter.ts        # Writes CSS/code changes back to files
│       ├── gitService.ts        # Git operations (clone, pull, push, status, commit)
│       └── forgecoreTypes.ts    # TypeScript types for forgecore.json schema
│
├── components/                  # React UI components
│   ├── App.tsx                  # Main application layout & state orchestration
│   ├── Sidebar.tsx              # Component/token browser with repo list
│   ├── ReactSandbox.tsx         # Sandboxed iframe for live component preview
│   ├── ReactSandbox/
│   │   └── sandboxTemplate.ts   # HTML template for the sandbox iframe
│   ├── PropertiesPanel.tsx      # Side panel for editing component properties
│   ├── PropertiesPanel/
│   │   ├── sections/            # Modular CSS editor sections
│   │   │   ├── TypographySection.tsx
│   │   │   ├── LayoutSection.tsx
│   │   │   ├── AppearanceSection.tsx
│   │   │   ├── EffectsSection.tsx
│   │   │   ├── PositionSection.tsx
│   │   │   ├── IdentitySection.tsx
│   │   │   ├── CSSPropertiesSection.tsx
│   │   │   ├── OtherPropertiesSection.tsx
│   │   │   └── AiSection.tsx
│   │   ├── hooks/
│   │   │   ├── useStyleOverrides.ts  # CSS override state management
│   │   │   └── useFileWriteback.ts   # Write CSS changes to disk
│   │   ├── primitives.tsx       # Reusable input components for the panel
│   │   ├── CodeBlock.tsx        # Syntax-highlighted code display
│   │   └── types.ts             # Panel-specific types
│   ├── AiFloatingChat.tsx       # Floating AI chat window (Gemini)
│   ├── AuthModal.tsx            # Firebase Google Sign-In modal
│   ├── ConnectModal.tsx         # Repository connection dialog
│   ├── SyncModal.tsx            # Git sync/commit/push dialog
│   ├── StateSelector.tsx        # Pseudo-state picker (hover, focus, etc.)
│   └── TitleBar.tsx             # Custom window title bar
│
├── hooks/
│   ├── useAppState.ts           # Centralized state management (useReducer)
│   ├── useAuth.ts               # Firebase authentication hook
│   └── useChangeHistory.ts      # Undo/redo change tracking
│
├── lib/
│   ├── esbuildCompiler.ts       # Browser-side esbuild-wasm JSX/TSX compiler
│   ├── cssModuleParser.ts       # CSS Module parser with variant categorization
│   ├── changeHistory.ts         # Change history data structures
│   ├── firebase.ts              # Firebase app initialization
│   └── userService.ts           # User profile Firestore operations
│
├── services/
│   └── geminiService.ts         # Google Gemini AI chat service
│
├── types/
│   ├── electron.d.ts            # Electron IPC type declarations
│   └── css.d.ts                 # CSS module type declarations
│
├── types.ts                     # Core domain types (ComponentNode, Repository, Token)
├── constants.ts                 # Initial/default values
├── index.html                   # HTML entry point
├── index.tsx                    # React DOM entry point
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript config (renderer)
├── tsconfig.electron.json       # TypeScript config (Electron main)
├── tsconfig.preload.json        # TypeScript config (preload script)
├── package.json                 # Dependencies and scripts
│
├── public/
│   ├── esbuild.wasm             # esbuild WebAssembly binary
│   ├── react.development.js     # React runtime for sandbox
│   ├── react-dom.development.js # ReactDOM runtime for sandbox
│   ├── logouiforge.svg          # App logo (SVG)
│   └── logouiforge.png          # App logo (PNG)
│
└── docs/
    ├── forgecore-guide.md       # Developer guide for forgecore.json
    └── forgecore-template.json  # Complete forgecore.json template
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10
- **Git** installed and configured

### Installation

```bash
git clone https://github.com/aizetachan/ui-forge.git
cd ui-forge
npm install
```

### Development

```bash
# Compile Electron TypeScript + start Vite dev server + launch Electron
npx tsc -p tsconfig.electron.json && npm run electron:dev
```

This will:
1. Compile the Electron main process TypeScript to `dist-electron/`.
2. Start the Vite dev server on `http://localhost:3000`.
3. Launch the Electron window pointing to the dev server.

### Production Build

```bash
npm run electron:build
```

Produces distributable binaries in the `release/` directory (DMG/ZIP for macOS, NSIS/Portable for Windows, AppImage/DEB for Linux).

---

## Configuration: forgecore.json

UI Forge reads a `forgecore.json` file from the root of any connected design-system repository. This file tells the app where to find components, how they're structured, and how to preview them.

See the full guide at [`docs/forgecore-guide.md`](docs/forgecore-guide.md) and the template at [`docs/forgecore-template.json`](docs/forgecore-template.json).

### Minimal Example

```json
{
  "name": "my-design-system",
  "version": "1.0.0",
  "componentRoot": "src/components",
  "components": {
    "Button": {
      "entry": "Button.tsx",
      "styles": "Button.module.css",
      "type": "input",
      "variants": [
        { "prop": "variant", "values": ["primary", "secondary", "ghost"], "default": "primary" },
        { "prop": "size", "values": ["sm", "md", "lg"], "default": "md" }
      ]
    }
  }
}
```

---

## Tech Stack

| Layer          | Technology                                     |
| -------------- | ---------------------------------------------- |
| Desktop Shell  | Electron 40+                                   |
| UI Framework   | React 19 + TypeScript 5.8                      |
| Build Tool     | Vite 6                                         |
| Compiler       | esbuild-wasm 0.27 (in-browser JSX/TSX)         |
| AST Parsing    | ts-morph (TypeScript compiler API)             |
| CSS Parsing    | Custom CSS Module parser (`cssModuleParser.ts`) |
| Git            | simple-git (Node.js Git wrapper)               |
| Auth           | Firebase Authentication (Google Sign-In)       |
| Database       | Cloud Firestore (user profiles & roles)        |
| AI             | Google Gemini API (`@google/genai`)             |
| Syntax Highlight | highlight.js                                 |
| Icons          | lucide-react                                   |

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Google Gemini API Key (for AI chat feature)
GEMINI_API_KEY=your_gemini_api_key

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

> ⚠️ Never commit `.env.local` to version control. It is already in `.gitignore`.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/aizetachan">aizetachan</a>
</p>
