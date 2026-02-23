/**
 * AI Assistant Service
 * 
 * General-purpose AI assistant for UI Forge with Gemini function calling.
 * 
 * Level 1: Query — answer questions about components, tokens, structure
 * Level 2: CSS/Prop Actions — modify CSS, props, variants (with user approval)
 * Level 3: Generation — create variants, suggest layouts (future, with approval)
 * 
 * Uses Google Gemini as the LLM backend with tool use.
 */
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

// ─── Types ───────────────────────────────────────────────────

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  /** If this message is a pending action proposal */
  action?: AiAction;
}

export interface AiAction {
  id: string;
  tool: string;
  args: Record<string, any>;
  description: string;
  status: 'pending' | 'approved' | 'denied';
}

export interface RepoContext {
  repoName: string;
  componentNames: string[];
  tokenCount: number;
  selectedComponent?: string;
  selectedComponentProps?: string[];
  /** Full component details for deep context */
  componentDetails?: {
    name: string;
    tagName: string;
    variants?: Array<{ name: string; type: string; cssClass: string }>;
    propDefs?: Array<{ name: string; type: string; defaultValue?: any; options?: string[] }>;
    cssProperties?: Record<string, string>;
    content?: string;
  };
  /** Available tokens grouped by type */
  tokensByType?: Record<string, Array<{ name: string; value: string }>>;
}

export type AiResponse =
  | { type: 'text'; content: string }
  | { type: 'action'; action: AiAction; rawResponse: any };

// ─── Client ──────────────────────────────────────────────────

const getClient = () => {
  // Vite exposes env vars via import.meta.env, not process.env
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY
    || (typeof process !== 'undefined' && process.env?.API_KEY)
    || '';
  if (!apiKey) {
    throw new Error(
      "API Key is missing. Set VITE_GEMINI_API_KEY in .env.local"
    );
  }
  return new GoogleGenAI({ apiKey });
};

// ─── Tool Declarations ───────────────────────────────────────

const toolDeclarations: FunctionDeclaration[] = [
  // Level 1: Queries (executed automatically, no approval needed)
  {
    name: "get_component_info",
    description: "Get detailed information about a specific component including its props, variants, CSS properties, and usage. Use this when the user asks about a component's API, styling, or structure.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        componentName: {
          type: Type.STRING,
          description: "Name of the component to look up (e.g. 'Button', 'Card')",
        },
      },
      required: ["componentName"],
    },
  },
  {
    name: "get_tokens",
    description: "Get the list of design tokens available in the repository, optionally filtered by type (color, spacing, typography, radius). Use this when the user asks about design tokens, colors, spacing values, etc.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          description: "Optional token type filter: 'color', 'spacing', 'typography', or 'radius'. Omit to get all tokens.",
        },
      },
    },
  },
  {
    name: "get_component_list",
    description: "Get the full list of components available in the connected repository with their types. Use this when the user asks what components exist.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },

  // Level 2: CSS/Prop Actions (require user approval)
  {
    name: "set_css_property",
    description: "Set a CSS property on the currently selected component. Use this when the user asks to change styling like padding, margin, color, font-size, etc. The change will be applied to the component's CSS Module file.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        property: {
          type: Type.STRING,
          description: "CSS property name (e.g. 'padding', 'background-color', 'font-size', 'border-radius')",
        },
        value: {
          type: Type.STRING,
          description: "CSS value to set (e.g. '16px', '#3b82f6', '1rem', '8px')",
        },
      },
      required: ["property", "value"],
    },
  },
  {
    name: "set_component_prop",
    description: "Set a prop value on the currently selected component in the preview. Use this when the user asks to change a component's prop like disabled, variant, size, label, etc.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        propName: {
          type: Type.STRING,
          description: "Name of the prop to set (e.g. 'disabled', 'label', 'size')",
        },
        value: {
          type: Type.STRING,
          description: "Value to set. For booleans use 'true'/'false', for strings use the string value, for enums use one of the valid options.",
        },
      },
      required: ["propName", "value"],
    },
  },
  {
    name: "set_variant",
    description: "Switch the active variant or size of the currently selected component. Use this when the user asks to preview a different variant, size, or state.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        variantCssClass: {
          type: Type.STRING,
          description: "CSS class name of the variant to activate (from the component's variant list)",
        },
      },
      required: ["variantCssClass"],
    },
  },
];

/** Tools that require user approval before execution */
const ACTION_TOOLS = new Set(['set_css_property', 'set_component_prop', 'set_variant']);

/** Tools that can be auto-executed (queries) */
const QUERY_TOOLS = new Set(['get_component_info', 'get_tokens', 'get_component_list']);

// ─── System Prompt ───────────────────────────────────────────

function buildSystemPrompt(context?: RepoContext): string {
  let prompt = `You are an AI assistant embedded in UI Forge, a desktop tool for previewing and editing design system components from Git repositories.

Your capabilities:
- Answer questions about the repository's components, props, variants, tokens, and CSS.
- Modify CSS properties on the selected component (requires user approval).
- Change component props in the preview (requires user approval).
- Switch between component variants (requires user approval).

Rules:
- Always use tools when available instead of guessing or hallucinating information.
- Speak English only.
- Be concise: 2-4 sentences for simple answers, bullet points for lists.
- When modifying values, use the EXACT property names and valid CSS values.
- For colors, prefer hex or CSS variables from the design system tokens.
- Do NOT generate Tailwind CSS. This design system uses CSS Modules.
- Format code with markdown fenced blocks when showing examples.
- When asked to make changes, use the appropriate tool — do NOT just describe the change.`;

  if (context) {
    prompt += `\n\nRepository: "${context.repoName}"`;
    prompt += `\nComponents (${context.componentNames.length}): ${context.componentNames.join(', ')}`;
    prompt += `\nDesign tokens: ${context.tokenCount} tokens loaded`;

    if (context.componentDetails) {
      const d = context.componentDetails;
      prompt += `\n\nCurrently selected: "${d.name}" (<${d.tagName}>)`;
      if (d.propDefs?.length) {
        prompt += `\nProps:`;
        for (const p of d.propDefs) {
          let line = `  - ${p.name}: ${p.type}`;
          if (p.defaultValue !== undefined) line += ` (default: ${JSON.stringify(p.defaultValue)})`;
          if (p.options?.length) line += ` [${p.options.join(' | ')}]`;
          prompt += `\n${line}`;
        }
      }
      if (d.variants?.length) {
        prompt += `\nVariants: ${d.variants.map(v => `${v.name} (${v.type}, class: ${v.cssClass})`).join(', ')}`;
      }
      if (d.cssProperties && Object.keys(d.cssProperties).length > 0) {
        prompt += `\nCurrent CSS:`;
        for (const [prop, val] of Object.entries(d.cssProperties)) {
          prompt += `\n  ${prop}: ${val}`;
        }
      }
    }

    if (context.tokensByType) {
      prompt += `\n\nDesign tokens:`;
      for (const [type, tokens] of Object.entries(context.tokensByType)) {
        if (tokens.length > 0) {
          prompt += `\n  ${type}: ${tokens.slice(0, 10).map(t => `${t.name}=${t.value}`).join(', ')}${tokens.length > 10 ? ` (+${tokens.length - 10} more)` : ''}`;
        }
      }
    }
  }

  return prompt;
}

// ─── Query Execution (auto, no approval) ─────────────────────

export function executeQuery(
  toolName: string,
  args: Record<string, any>,
  context?: RepoContext,
  repo?: { components: any[]; tokens: any[] },
): string {
  switch (toolName) {
    case 'get_component_info': {
      const name = args.componentName;
      const comp = repo?.components.find((c: any) => c.name.toLowerCase() === name.toLowerCase());
      if (!comp) return JSON.stringify({ error: `Component "${name}" not found.` });
      return JSON.stringify({
        name: comp.name,
        tagName: comp.tagName,
        props: comp.propDefs?.map((p: any) => ({
          name: p.name, type: p.type, default: p.defaultValue, options: p.options,
        })) || [],
        variants: comp.variants?.map((v: any) => ({
          name: v.name, type: v.type, cssClass: v.cssClass,
        })) || [],
        componentType: comp.componentType,
        hasCSS: !!comp.rawCSS,
      });
    }
    case 'get_tokens': {
      const tokens = repo?.tokens || [];
      const typeFilter = args.type;
      const filtered = typeFilter
        ? tokens.filter((t: any) => t.type === typeFilter)
        : tokens;
      return JSON.stringify({
        count: filtered.length,
        tokens: filtered.slice(0, 30).map((t: any) => ({ name: t.name, value: t.value, type: t.type })),
        truncated: filtered.length > 30,
      });
    }
    case 'get_component_list': {
      const components = repo?.components || [];
      return JSON.stringify({
        count: components.length,
        components: components.map((c: any) => ({
          name: c.name,
          type: c.componentType || 'unknown',
          variantCount: c.variants?.length || 0,
          propCount: c.propDefs?.length || 0,
        })),
      });
    }
    default:
      return JSON.stringify({ error: `Unknown query tool: ${toolName}` });
  }
}

// ─── Action Description (human-readable) ─────────────────────

function describeAction(toolName: string, args: Record<string, any>): string {
  switch (toolName) {
    case 'set_css_property':
      return `Set CSS \`${args.property}\` to \`${args.value}\``;
    case 'set_component_prop':
      return `Set prop \`${args.propName}\` to \`${args.value}\``;
    case 'set_variant':
      return `Switch to variant \`${args.variantCssClass}\``;
    default:
      return `Execute ${toolName}`;
  }
}

// ─── Public API ──────────────────────────────────────────────

let _lastContents: any[] = [];
let _lastModelContent: any = null;
let _config: any = null;

function getConfig(context?: RepoContext) {
  return {
    systemInstruction: buildSystemPrompt(context),
    tools: [{ functionDeclarations: toolDeclarations }],
  };
}

/**
 * Send a message to the AI assistant.
 * Returns either a text response or an action proposal that needs user approval.
 */
export async function askAssistant(
  message: string,
  context?: RepoContext,
  history: AiMessage[] = [],
  repo?: { components: any[]; tokens: any[] },
): Promise<AiResponse> {
  const ai = getClient();

  // Build conversation contents
  const contents: Array<any> = [];

  for (const msg of history) {
    // Skip action messages from history — just include their text
    if (msg.action) continue;
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    });
  }

  contents.push({
    role: 'user',
    parts: [{ text: message }],
  });

  _config = getConfig(context);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    config: _config,
    contents,
  });

  // Check if the response contains a function call
  const functionCalls = response.functionCalls;

  if (functionCalls && functionCalls.length > 0) {
    const fc = functionCalls[0];
    const name = fc.name!;
    const args = fc.args || {};

    // Query tools: auto-execute and feed result back to Gemini
    if (QUERY_TOOLS.has(name)) {
      const result = executeQuery(name, args, context, repo);

      // Build follow-up: original contents + model's response + function result
      const followUp = [...contents];
      // Push the model's content as-is (from the response)
      followUp.push(response.candidates![0].content);
      // Push function response from user
      followUp.push({
        role: 'user',
        parts: [{ functionResponse: { name, response: JSON.parse(result) } }],
      });

      const finalResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: _config,
        contents: followUp,
      });

      _lastContents = followUp;
      return {
        type: 'text',
        content: finalResponse.text?.trim() || "I couldn't generate a response.",
      };
    }

    // Action tools: return as proposal for user approval
    if (ACTION_TOOLS.has(name)) {
      _lastContents = contents;
      _lastModelContent = response.candidates![0].content;
      return {
        type: 'action',
        action: {
          id: `action_${Date.now()}`,
          tool: name,
          args: args,
          description: describeAction(name, args),
          status: 'pending',
        },
        rawResponse: fc,
      };
    }
  }

  // Regular text response
  _lastContents = contents;
  return {
    type: 'text',
    content: response.text?.trim() || "I couldn't generate a response.",
  };
}

/**
 * After user approves/denies an action, send the result back to Gemini.
 * Returns the AI's final response acknowledging the action.
 */
export async function confirmAction(
  action: AiAction,
  approved: boolean,
  context?: RepoContext,
): Promise<string> {
  const ai = getClient();

  const contents = [..._lastContents];

  // Add the model's function call content (preserved from the original response)
  if (_lastModelContent) {
    contents.push(_lastModelContent);
  } else {
    contents.push({
      role: 'model',
      parts: [{ functionCall: { name: action.tool, args: action.args } }],
    });
  }

  // Add the function response
  const resultObj = approved
    ? { status: 'success', message: `Action executed: ${action.description}` }
    : { status: 'denied', message: 'Action was denied by the user.' };

  contents.push({
    role: 'user',
    parts: [{ functionResponse: { name: action.tool, response: resultObj } }],
  });

  const config = _config || getConfig(context);
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    config,
    contents,
  });

  _lastContents = contents;
  _lastModelContent = null;
  return response.text?.trim() || (approved ? "Done." : "Understood, action cancelled.");
}