# Forgecore.json — Developer Guide

> **Version**: forgecore v1.0  
> **Audience**: Any developer who wants their component library to work with **UI Forge**.

---

## What is `forgecore.json`?

A single manifest file placed at the **root** of your Design System repository. It tells UI Forge:

1. **Where** your components, styles, and tokens live.
2. **How** to compile and preview them (bundler, aliases, theme).
3. **What** props, variants, and interactions each component supports.

> [!IMPORTANT]
> Without `forgecore.json`, UI Forge falls back to auto-discovery (scanning `.tsx` + `.module.css`), but results are significantly worse. **Always include a manifest.**

---

## Quick Start (3 minutes)

### 1. Create the file

```bash
touch forgecore.json   # at the root of your repo
```

### 2. Paste the minimal template

```jsonc
{
  "name": "my-design-system",
  "version": "1.0.0",

  "runtime": {
    "globalCss": ["src/styles/tokens.css"]
  },

  "components": {
    "Button": {
      "entry": "src/components/Button/Button.tsx",
      "styles": ["src/components/Button/Button.module.css"],
      "defaultProps": {
        "children": "Click me"
      }
    }
  }
}
```

### 3. Connect the repo in UI Forge

Clone or select the repository → UI Forge reads `forgecore.json` → your components appear instantly.

---

## Full Annotated Template

Below is the **complete** template with every supported field. Copy what you need, delete what you don't.

```jsonc
{
  // ─── IDENTITY ──────────────────────────────────────────────
  "$schema": "https://forgecore.dev/schemas/forgecore.v1.json",
  "forgecoreVersion": "1.0.0",
  "name": "my-design-system",           // REQUIRED — unique name
  "version": "1.0.0",
  "description": "A modern React component library",

  // ─── PACKAGE METADATA (optional) ──────────────────────────
  "package": {
    "displayName": "My Design System",
    "npmName": "@myorg/design-system",
    "version": "1.0.0",
    "license": "MIT",
    "repoURL": "https://github.com/myorg/design-system.git",
    "homepage": "https://design.myorg.com",
    "author": "Design Team"
  },

  // ─── FRAMEWORK METADATA (optional) ────────────────────────
  "metadata": {
    "framework": "react",               // react | vue | angular | svelte | vanilla
    "language": "typescript",            // typescript | javascript
    "moduleFormat": "esm",              // esm | cjs
    "monorepo": false,
    "entryStrategy": "source",          // source = read .tsx directly | build = use dist/
    "notes": [
      "Free-text notes about this design system."
    ]
  },

  // ─── PREVIEW SETTINGS ─────────────────────────────────────
  "preview": {
    "mode": "esbuild",                  // esbuild | vite | auto
    "theme": "dark",                    // dark | light — default theme for sandbox
    "background": "#09090b",            // sandbox background color
    "viewport": {
      "width": 1200,
      "height": 800,
      "deviceScaleFactor": 1
    },
    "behavior": {
      "disableAnimations": false,
      "preferReducedMotion": true,
      "logEvents": true,                // log component events to console
      "captureConsole": true
    }
  },

  // ─── RUNTIME CONFIGURATION ────────────────────────────────
  "runtime": {
    "react": { "version": "18.x" },

    "bundler": {
      "type": "esbuild",               // esbuild | vite
      "platform": "browser",           // browser | node
      "jsx": "automatic",              // automatic | classic
      "tsconfigPath": "tsconfig.json",
      "define": {
        "process.env.NODE_ENV": "\"production\""
      }
    },

    // Path aliases (like tsconfig paths)
    "aliases": {
      "@": "src",
      "@/utils": "src/utils",
      "@/components": "src/components",
      "@/styles": "src/styles"
    },

    // Global CSS files loaded into the sandbox
    "globalCss": [
      "src/styles/globals.css",
      "src/styles/themes/dark.css",
      "src/styles/themes/light.css"
    ],

    // Theme switching configuration
    "theme": {
      "strategy": "attribute",          // attribute | class
      "attribute": "data-theme",        // HTML attribute name
      "values": ["dark", "light"],
      "default": "dark",
      "applyTo": "documentElement"      // where to set the attribute
    },

    // Sandbox mount options
    "mount": {
      "rootId": "forge-root",
      "wrapper": {
        "element": "div",
        "props": {
          "style": "min-height:100vh; padding:24px; box-sizing:border-box;"
        }
      }
    },

    // Portal support (for modals, tooltips, etc.)
    "portals": {
      "enabled": true,
      "rootId": "forge-portal-root",
      "attachTo": "body",
      "createIfMissing": true
    },

    // Icon library stubs
    "stubs": {
      "icons": {
        "library": "lucide-react",      // icon library to stub
        "enabled": true,
        "strategy": "component",        // component | svg
        "fallback": "span"
      }
    }
  },

  // ─── UTILITY FUNCTIONS ────────────────────────────────────
  // Functions used by components (e.g. cn, clsx) that need stubs in the sandbox
  "utilities": {
    "cn": {
      "path": "src/utils/cn.ts",
      "export": { "type": "named", "name": "cn" },
      "stub": "function cn(){return Array.from(arguments).filter(Boolean).join(' ')}"
    }
  },

  // ─── DESIGN TOKENS ────────────────────────────────────────
  "tokens": {
    "type": "css-variables",            // css-variables | json
    "css": [
      "src/styles/globals.css",
      "src/styles/themes/dark.css"
    ],
    "categories": {                     // prefix → category mapping for token panel
      "colors": "--my-color-",
      "spacing": "--my-space-",
      "typography": "--my-font-",
      "radius": "--my-radius-"
    }
  },

  // ─── ASSETS ───────────────────────────────────────────────
  "assets": {
    "icons": {
      "library": "lucide-react",
      "stub": true                      // auto-generate icon stubs
    },
    "images": "public/images",
    "fonts": "public/fonts"
  },

  // ─── COMPONENTS ───────────────────────────────────────────
  // This is the core section — see detailed reference below
  "components": {
    // ... component definitions here
  }
}
```

---

## Component Definition Reference

Each key in `components` is the **component name** (must match the exported React component name).

### Minimal Component

```jsonc
{
  "Button": {
    "entry": "src/components/Button/Button.tsx",     // REQUIRED
    "styles": ["src/components/Button/Button.module.css"],
    "defaultProps": {
      "children": "Click me"
    }
  }
}
```

### Full Component (all fields)

```jsonc
{
  "Button": {
    // ─── Entry & Exports ───────────────────────
    "entry": "src/components/Button/Button.tsx",     // REQUIRED — relative path to component file
    "export": { "type": "named", "name": "Button" }, // named | default
    "styles": [                                       // CSS Module file(s)
      "src/components/Button/Button.module.css"
    ],
    "types": "src/components/Button/Button.types.ts", // optional types file
    "dependencies": [                                  // other files this component needs
      "src/utils/cn.ts",
      "src/components/Icon/Icon.tsx"
    ],
    "externalDeps": ["framer-motion"],                // npm packages (for reference)

    // ─── Component Category ────────────────────
    "type": "input",
    // Options: display | input | layout | navigation | overlay | feedback

    // ─── Interaction Model ─────────────────────
    "model": {
      "pattern": "controlledValue",
      // Options: controlledValue | controlledBoolean | uncontrolled
      "events": ["onChange", "onBlur"],
      "a11y": {
        "role": "button"
      }
    },

    // ─── Variants ──────────────────────────────
    // Maps to CSS classes and generates selector dropdowns in the UI
    "variants": [
      {
        "prop": "variant",                            // prop name in the component
        "values": ["primary", "secondary", "ghost", "danger"],
        "default": "primary"
      },
      {
        "prop": "size",
        "values": ["sm", "md", "lg"],
        "default": "md"
      }
    ],

    // ─── Prop Definitions (optional) ───────────
    // Explicit control over the properties panel
    // If omitted, UI Forge infers from variants + defaultProps + TypeScript interface
    "propDefs": [
      { "name": "children",  "type": "string",  "defaultValue": "Click me" },
      { "name": "disabled",  "type": "boolean", "defaultValue": false },
      { "name": "variant",   "type": "enum",    "options": ["primary", "secondary", "ghost"], "defaultValue": "primary" },
      { "name": "size",      "type": "enum",    "options": ["sm", "md", "lg"], "defaultValue": "md" },
      { "name": "count",     "type": "number",  "defaultValue": 0 }
    ],
    // Supported types: string | number | boolean | enum | array | reactnode

    // ─── Default Props ─────────────────────────
    // Initial values shown in the preview
    "defaultProps": {
      "children": "Click me",
      "variant": "primary",
      "size": "md",
      "disabled": false,
      "isLoading": false,
      "fullWidth": false
    },

    // ─── Forge Preview Config ──────────────────
    "forge": {
      "requiresPortal": false,           // true for modals, dialogs, toasts

      // Slot definitions (for trigger-based components)
      "slots": {
        "trigger": {
          "kind": "Button",
          "props": { "children": "Open" }
        }
      },

      // Custom preview template (JSX string)
      // Use {props.xxx} to reference the current prop values
      "showcase": "<Button variant={props.variant} size={props.size}>{props.children}</Button>"
    },

    // ─── Per-Component Preview Options ─────────
    "preview": {
      "forceVisible": true,              // force visible (tooltips, dropdowns)
      "disableAnimations": true,         // disable CSS animations
      "portal": true,                    // render inside portal root
      "wrapperStyle": {                  // style for the preview wrapper
        "width": "300px"
      }
    },

    // ─── Test Scenarios (future) ───────────────
    "scenarios": [
      {
        "name": "Click and verify",
        "props": { "children": "Submit", "variant": "primary" },
        "actions": [
          { "type": "click", "target": "button" },
          { "type": "wait", "ms": 500 }
        ]
      }
    ]
  }
}
```

---

## Field Priority: How Props Are Resolved

UI Forge resolves component props in this order (highest priority first):

| Priority | Source | Description |
|----------|--------|-------------|
| 1 | `propDefs` | Explicit prop definitions in forgecore.json |
| 2 | `variants` | Auto-generates enum propDefs from variant definitions |
| 3 | `defaultProps` | Infers type from runtime values (boolean, number, string, etc.) |
| 4 | TypeScript Interface | Extracts from the component's `.tsx` props interface |

> [!TIP]
> For most components, you only need `variants` + `defaultProps`. UI Forge will infer the rest from TypeScript. Use `propDefs` only when you need precise control.

---

## Showcase Templates

The `forge.showcase` field lets you define exactly how a component renders in the preview. This is essential for **composite components** (Card with header/body/footer, Tabs with panels, etc.).

### Rules

- Write JSX as a string
- Use `{props.xxx}` to reference current prop values from the properties panel
- Sub-components exported from the same file are automatically available
- Wrap in a container `<div>` if you need to constrain width

### Examples

**Simple component** (no showcase needed):
```jsonc
// UI Forge renders: <Button {...props}>children</Button>
// No showcase necessary for single-element components
```

**Composite component** (Card with sub-components):
```jsonc
"showcase": "<Card variant={props.variant}><CardHeader title='Title' /><CardBody><p>Content</p></CardBody><CardFooter><Button>OK</Button></CardFooter></Card>"
```

**Overlay component** (must be forced open):
```jsonc
"showcase": "<Modal open={true} onClose={() => {}} title={props.title}><ModalBody>Content</ModalBody></Modal>"
```

**Width-constrained component**:
```jsonc
"showcase": "<div style={{width:'280px'}}><Input label={props.label} placeholder={props.placeholder} /></div>"
```

---

## Common Patterns

### Pattern 1: Simple Display Component

```jsonc
"Badge": {
  "entry": "src/components/Badge/Badge.tsx",
  "styles": ["src/components/Badge/Badge.module.css"],
  "dependencies": ["src/utils/cn.ts"],
  "type": "display",
  "variants": [
    { "prop": "variant", "values": ["default", "success", "error", "warning"], "default": "default" },
    { "prop": "size", "values": ["sm", "md", "lg"], "default": "md" }
  ],
  "defaultProps": {
    "children": "Badge",
    "variant": "default",
    "size": "md"
  }
}
```

### Pattern 2: Controlled Input

```jsonc
"Input": {
  "entry": "src/components/Input/Input.tsx",
  "styles": ["src/components/Input/Input.module.css"],
  "dependencies": ["src/utils/cn.ts"],
  "type": "input",
  "model": {
    "pattern": "controlledValue",
    "events": ["onChange"]
  },
  "variants": [
    { "prop": "state", "values": ["default", "error", "success"], "default": "default" },
    { "prop": "size", "values": ["sm", "md", "lg"], "default": "md" }
  ],
  "defaultProps": {
    "label": "Email",
    "placeholder": "Enter email...",
    "state": "default",
    "size": "md"
  },
  "forge": {
    "showcase": "<div style={{width:'280px'}}><Input label={props.label} placeholder={props.placeholder} state={props.state} size={props.size} /></div>"
  }
}
```

### Pattern 3: Overlay / Modal

```jsonc
"AlertDialog": {
  "entry": "src/components/AlertDialog/AlertDialog.tsx",
  "styles": ["src/components/AlertDialog/AlertDialog.module.css"],
  "dependencies": ["src/utils/cn.ts", "src/components/Button/Button.tsx"],
  "type": "overlay",
  "model": {
    "pattern": "controlledBoolean",
    "events": ["onClose", "onConfirm"]
  },
  "defaultProps": {
    "open": false,
    "title": "Confirm Action",
    "description": "Are you sure?",
    "confirmLabel": "Confirm",
    "cancelLabel": "Cancel"
  },
  "forge": {
    "requiresPortal": true,
    "showcase": "<AlertDialog open={true} onClose={() => {}} title={props.title} description={props.description} />"
  }
}
```

### Pattern 4: Composite Layout Component

```jsonc
"Tabs": {
  "entry": "src/components/Tabs/Tabs.tsx",
  "styles": ["src/components/Tabs/Tabs.module.css"],
  "dependencies": ["src/utils/cn.ts"],
  "type": "navigation",
  "model": {
    "pattern": "controlledValue",
    "events": ["onValueChange"]
  },
  "variants": [
    { "prop": "variant", "values": ["default", "pills", "underline"], "default": "default" }
  ],
  "defaultProps": {
    "variant": "default",
    "defaultValue": "tab1"
  },
  "forge": {
    "showcase": "<Tabs defaultValue='tab1' variant={props.variant}><TabList><Tab value='tab1'>General</Tab><Tab value='tab2'>Settings</Tab></TabList><TabPanel value='tab1'><p>General content</p></TabPanel><TabPanel value='tab2'><p>Settings content</p></TabPanel></Tabs>"
  }
}
```

---

## Expected Repository Structure

```
my-design-system/
├── forgecore.json                    ← Manifest (root)
├── src/
│   ├── styles/
│   │   ├── globals.css               ← Base tokens (spacing, font, radius)
│   │   └── themes/
│   │       ├── dark.css              ← Color tokens (dark)
│   │       └── light.css             ← Color tokens (light)
│   ├── utils/
│   │   └── cn.ts                     ← Utility functions
│   └── components/
│       ├── Button/
│       │   ├── Button.tsx            ← Component source
│       │   └── Button.module.css     ← CSS Module
│       ├── Input/
│       │   ├── Input.tsx
│       │   └── Input.module.css
│       └── Card/
│           ├── Card.tsx
│           └── Card.module.css
└── public/
    ├── images/
    └── fonts/
```

> [!NOTE]
> All paths in `forgecore.json` are **relative to the repository root**. Never use absolute paths.

---

## Checklist Before Connecting

- [ ] `forgecore.json` exists at the repository root
- [ ] Every component has an `entry` pointing to a valid `.tsx` file
- [ ] `styles` paths point to actual `.module.css` files
- [ ] `defaultProps` includes `children` for components that render text
- [ ] `globalCss` lists all CSS files needed for tokens/themes
- [ ] `aliases` matches your `tsconfig.json` paths
- [ ] `dependencies` lists utility files (`cn.ts`) used by components
- [ ] Overlay components have `forge.requiresPortal: true` and `forge.showcase` with `open={true}`
- [ ] Composite components have a `forge.showcase` showing sub-components

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Component not showing | Wrong `entry` path | Check path is relative to repo root |
| No styles applied | Missing `styles` or `globalCss` | Add CSS Module path and global token files |
| Props panel empty | No `variants`/`defaultProps`/`propDefs` | Add at least `defaultProps` |
| Overlay invisible | Not forced open in preview | Add `forge.showcase` with `open={true}` |
| Alias errors (`@/utils/cn`) | Missing `runtime.aliases` | Add alias mappings |
| Icon not rendering | Icon library not stubbed | Add `runtime.stubs.icons` config |
| Sub-components unstyled | Missing dependency CSS | Add parent component to `dependencies` |
