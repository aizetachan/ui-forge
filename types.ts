
export enum ElementType {
  BUTTON = 'button',
  DIV = 'div',
  SPAN = 'span',
  HEADING = 'h1',
  PARAGRAPH = 'p',
  INPUT = 'input'
}

export type TokenType = 'color' | 'spacing' | 'typography' | 'radius';

export interface Token {
  id: string;
  name: string;
  value: string;
  type: TokenType;  // Uses the TokenType alias for consistency
}

// Component variant definition
export interface ComponentVariant {
  name: string;
  type: 'variant' | 'size' | 'state';
  cssClass: string;
  isDefault?: boolean;
}

// Story variant from .stories.tsx files
export interface StoryVariant {
  name: string;           // Story name e.g. "Default", "Primary", "Sizes"
  args?: Record<string, any>; // Default args for this story
  hasRender?: boolean;    // True if story uses render function instead of args
}

// Component property definition for controls
export interface ComponentPropDef {
  name: string;
  type: string; // 'string' | 'boolean' | 'enum' | 'number' | 'array' | 'object' | 'reactnode' | 'function'
  control?: 'text' | 'number' | 'boolean' | 'select' | 'json' | 'slot' | 'none'; // Panel editor type
  options?: string[]; // for enums
  defaultValue?: any;
}

// Represents a parsed component structure for the visual editor
export interface ComponentNode {
  id: string;
  name: string; // Component Name e.g. "Button"
  tagName: ElementType;
  classes: string; // Base CSS classes
  content?: string; // Text content
  sourceCode?: string; // Full component source code for runtime rendering
  showcase?: string; // JSX template for rich preview (compound components)
  props: Record<string, string | number | boolean>;
  propDefs?: ComponentPropDef[]; // Property definitions for controls
  children?: ComponentNode[]; // For nested structures
  dependencies?: string[]; // Component dependencies from forgecore.json

  // File paths for write-back (absolute paths)
  filePath?: string; // Absolute path to the component .tsx file
  forgecorePath?: string; // Absolute path to forgecore.json

  // Component category from forgecore.json
  componentType?: 'display' | 'input' | 'layout' | 'navigation' | 'overlay' | 'feedback';

  // Interaction model from forgecore.json
  model?: {
    pattern: 'controlledBoolean' | 'controlledValue' | 'uncontrolled';
    events: string[];
  };

  // Forge configuration for preview
  forgeConfig?: {
    requiresPortal?: boolean;
    slots?: Record<string, { kind?: string; props?: Record<string, any> }>;
    showcase?: string;
  };

  // Per-component preview configuration
  previewConfig?: {
    forceVisible?: boolean;
    disableAnimations?: boolean;
    portal?: boolean;
    wrapperStyle?: Record<string, any>;
  };

  // Props that should be auto-wrapped as React elements (from forgecore elementProps)
  elementProps?: string[];
  // Callback prop names that should be auto-stubbed (from forgecore callbacks)
  callbacks?: string[];

  // Inline style overrides - for editing padding/margin/colors on CSS Module components
  styleOverrides?: Record<string, string | number>;

  // Variant-scoped style overrides - keyed by `${variant}_${size}` e.g. "primary_md"
  styleOverridesPerVariant?: Record<string, Record<string, string | number>>;

  // CSS Module support
  rawCSS?: string; // Raw CSS from component's .module.css file
  cssModulePath?: string; // Path to the CSS module file

  // Variant support
  variants?: ComponentVariant[];
  selectedVariant?: string; // Currently selected variant
  selectedSize?: string; // Currently selected size

  // Story variants from .stories.tsx (for Storybook-like sidebar)
  storyVariants?: StoryVariant[];
}

export interface RepoAssets {
  icons: Array<{ name: string; svgContent: string; relativePath: string }>;
  images: Array<{ name: string; relativePath: string; mimeType: string }>;
  baseURL: string; // "forge-asset://repo/"
}

export interface Repository {
  id: string;
  name: string;
  url: string;
  branch: string;
  lastSync: string;
  components: ComponentNode[];
  tokens: Token[];

  // Theme CSS injection
  themeCSS?: string; // Raw theme CSS with CSS variables
  repoPath?: string; // Local path to cloned repo

  // Phase 1: Sandbox runtime config
  utilities?: Record<string, {
    path: string;
    export: string | { type: 'named' | 'default'; name: string };
    stub?: string;
  }>;
  aliases?: Record<string, string>;

  // Phase 3: Preview config
  preview?: {
    mode?: string;
    theme?: string;
    background?: string;
    behavior?: {
      disableAnimations?: boolean;
      preferReducedMotion?: boolean;
    };
  };

  // Runtime config from forgecore.json
  runtime?: {
    theme?: {
      strategy?: 'attribute' | 'class';
      attribute?: string;
      values?: string[];
      default?: string;
      applyTo?: string;
    };
    mount?: {
      rootId?: string;
      wrapper?: {
        element?: string;
        props?: Record<string, any>;
      };
    };
  };

  // Phase 4: Repository assets (icons & images)
  repoAssets?: RepoAssets;
}


export interface SyncPayload {
  branch: string;
  message: string;
  createPR: boolean;
}
