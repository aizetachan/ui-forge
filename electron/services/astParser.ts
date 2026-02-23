/**
 * AST-based TypeScript prop extraction using ts-morph.
 *
 * Replaces the Regex-based extractPropDefinitions in repoParser.ts with
 * a proper AST analysis that resolves type aliases, union types,
 * extended interfaces, generics (Omit, Pick), and default values.
 *
 * Returns the exact same ComponentPropDef[] shape used everywhere else
 * so it's a drop-in replacement with zero interface changes.
 */

import { Project, SyntaxKind, Type, Node, ts } from 'ts-morph';
import path from 'path';
import type { ComponentPropDef } from './forgecoreTypes.js';

// Cache projects per repo to avoid re-parsing on every component
const projectCache = new Map<string, Project>();

/**
 * Get or create a ts-morph Project for a repository.
 * Uses the repo's tsconfig.json if available for correct path aliases.
 */
function getProject(repoPath: string): Project {
    if (projectCache.has(repoPath)) {
        return projectCache.get(repoPath)!;
    }

    const tsconfigPath = path.join(repoPath, 'tsconfig.json');
    let project: Project;

    try {
        project = new Project({
            tsConfigFilePath: tsconfigPath,
            skipAddingFilesFromTsConfig: true, // We add files on demand
            compilerOptions: {
                // Ensure we can resolve even without full node_modules
                skipLibCheck: true,
                noEmit: true,
            },
        });
    } catch {
        // No tsconfig or invalid — create a basic project
        project = new Project({
            compilerOptions: {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Bundler,
                jsx: ts.JsxEmit.ReactJSX,
                strict: true,
                skipLibCheck: true,
                noEmit: true,
                baseUrl: repoPath,
                paths: { '@/*': ['src/*'] },
            },
        });
    }

    projectCache.set(repoPath, project);
    return project;
}

/**
 * Extract PropDefs from a component file using AST analysis.
 *
 * Handles:
 * - `React.FC<Props>` pattern
 * - `React.forwardRef<Element, Props>` pattern
 * - `extends React.HTMLAttributes<...>` (inheriting props)
 * - `Omit<Base, 'key'>` wrappers
 * - Type alias resolution (`type Variant = 'a' | 'b'`)
 * - Default values from destructuring
 *
 * @returns ComponentPropDef[] — same shape as the Regex-based version
 */
export async function extractPropDefsFromAST(
    filePath: string,
    componentName: string,
    repoPath: string,
): Promise<ComponentPropDef[]> {
    const propDefs: ComponentPropDef[] = [];

    try {
        const project = getProject(repoPath);

        // Add the file if not already added
        let sourceFile = project.getSourceFile(filePath);
        if (!sourceFile) {
            sourceFile = project.addSourceFileAtPath(filePath);
        }

        // ── Step 1: Find the props interface ─────────────────────

        // Strategy A: Look for interface named {ComponentName}Props
        const interfaceName = `${componentName}Props`;
        let propsType: Type | null = null;

        const iface = sourceFile.getInterface(interfaceName);
        if (iface) {
            propsType = iface.getType();
        }

        // Strategy B: Find from React.FC<Props> or React.forwardRef<El, Props>
        if (!propsType) {
            propsType = findPropsTypeFromComponent(sourceFile, componentName);
        }

        if (!propsType) {
            console.log(`[ASTParser] No props type found for ${componentName}`);
            return [];
        }

        // ── Step 2: Extract default values from destructuring ────
        const defaults = extractDefaultValues(sourceFile, componentName);

        // ── Step 3: Extract each property ────────────────────────
        const SKIP_PROPS = new Set([
            'className', 'style', 'ref', 'key',
            // Skip common inherited HTML attributes that aren't design-system-relevant
            'id', 'tabIndex', 'role', 'aria-label', 'aria-labelledby',
            'aria-describedby', 'aria-hidden', 'data-testid',
        ]);

        const properties = propsType.getProperties();

        for (const prop of properties) {
            const name = prop.getName();
            if (SKIP_PROPS.has(name)) continue;

            // Skip inherited HTML event handlers (onClick, onChange, etc.)
            // unless they're explicitly declared in the component's own interface
            const declarations = prop.getDeclarations();
            const isOwnProp = declarations.some(d => {
                const sf = d.getSourceFile();
                return sf.getFilePath() === filePath;
            });

            // For inherited props like onFocus, onBlur — skip unless declared locally
            if (!isOwnProp && name.startsWith('on') && name.length > 2) continue;
            // Skip all non-own props from HTMLAttributes to keep the panel clean
            if (!isOwnProp) continue;

            const propType = prop.getTypeAtLocation(sourceFile);
            const resolved = resolveType(propType, name);

            propDefs.push({
                name,
                type: resolved.type,
                options: resolved.options,
                defaultValue: defaults.get(name),
                control: resolved.control,
            });
        }

        console.log(`[ASTParser] ${componentName}: extracted ${propDefs.length} propDefs via AST`);

    } catch (error: any) {
        console.warn(`[ASTParser] Failed for ${componentName}, will fall back to Regex:`, error.message);
        return []; // Empty = caller uses Regex fallback
    }

    return propDefs;
}

/**
 * Find the Props type from a component's type annotation.
 * Handles React.FC<Props> and React.forwardRef<El, Props>.
 */
function findPropsTypeFromComponent(
    sourceFile: ReturnType<Project['addSourceFileAtPath']>,
    componentName: string,
): Type | null {
    // Look for: export const ComponentName = React.forwardRef<El, Props>(...)
    // or: export const ComponentName: React.FC<Props> = ...
    const varDecl = sourceFile.getVariableDeclaration(componentName);
    if (!varDecl) return null;

    // Check type annotation: React.FC<Props>
    const typeNode = varDecl.getTypeNode();
    if (typeNode) {
        const typeText = typeNode.getText();
        // Extract Props from React.FC<Props>
        const fcMatch = typeText.match(/React\.FC\s*<\s*(\w+)\s*>/);
        if (fcMatch) {
            const propsName = fcMatch[1];
            const iface = sourceFile.getInterface(propsName);
            if (iface) return iface.getType();
            const typeAlias = sourceFile.getTypeAlias(propsName);
            if (typeAlias) return typeAlias.getType();
        }
    }

    // Check initializer for forwardRef pattern
    const init = varDecl.getInitializer();
    if (init) {
        const initText = init.getText();
        // React.forwardRef<HTMLButtonElement, ButtonProps>(...)
        const fwdMatch = initText.match(/React\.forwardRef\s*<\s*\w+\s*,\s*(\w+)\s*>/);
        if (fwdMatch) {
            const propsName = fwdMatch[1];
            const iface = sourceFile.getInterface(propsName);
            if (iface) return iface.getType();
            const typeAlias = sourceFile.getTypeAlias(propsName);
            if (typeAlias) return typeAlias.getType();
        }
    }

    return null;
}

/**
 * Extract default values from the component's parameter destructuring.
 * e.g., ({ variant = 'primary', size = 'md', disabled = false }) => ...
 */
function extractDefaultValues(
    sourceFile: ReturnType<Project['addSourceFileAtPath']>,
    componentName: string,
): Map<string, any> {
    const defaults = new Map<string, any>();

    // Search all arrow functions and function expressions for destructured params
    const text = sourceFile.getFullText();

    // Pattern 1: forwardRef<..., Props>(({ prop = val, ... }, ref) => ...
    // Pattern 2: const Comp: FC<Props> = ({ prop = val, ... }) => ...
    // We find the destructuring block using a broad regex,
    // then parse default assignments from it.

    // Find the component's arrow function with destructured props
    const patterns = [
        // forwardRef pattern
        new RegExp(`React\\.forwardRef.*?\\(\\s*\\(\\s*\\{([^}]+)\\}\\s*,\\s*ref`, 's'),
        // FC arrow pattern
        new RegExp(`${componentName}[^=]*=\\s*\\(\\s*\\{([^}]+)\\}\\s*\\)\\s*=>`, 's'),
        // Standard function pattern
        new RegExp(`function\\s+${componentName}\\s*\\(\\s*\\{([^}]+)\\}`, 's'),
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const destructuredBlock = match[1];
            // Parse: propName = value assignments
            const assignRegex = /(\w+)\s*=\s*([^,\n]+)/g;
            let assignMatch;
            while ((assignMatch = assignRegex.exec(destructuredBlock)) !== null) {
                const propName = assignMatch[1].trim();
                let rawValue: string = assignMatch[2].trim();

                // Clean up trailing chars
                rawValue = rawValue.replace(/\s*\/\/.*$/, '').trim();

                // Parse value
                if (rawValue === 'true') defaults.set(propName, true);
                else if (rawValue === 'false') defaults.set(propName, false);
                else if (/^\d+$/.test(rawValue)) defaults.set(propName, parseInt(rawValue));
                else if (/^\d+\.\d+$/.test(rawValue)) defaults.set(propName, parseFloat(rawValue));
                else if (rawValue.startsWith("'") || rawValue.startsWith('"')) {
                    defaults.set(propName, rawValue.replace(/^['"]|['"]$/g, ''));
                }
            }
            break;
        }
    }

    return defaults;
}

/**
 * Resolve a ts-morph Type to our PropDef type string + options.
 */
function resolveType(
    type: Type,
    propName: string,
): { type: string; options?: string[]; control?: ComponentPropDef['control'] } {

    // Boolean
    if (type.isBoolean() || type.isBooleanLiteral()) {
        return { type: 'boolean', control: 'boolean' };
    }

    // Number
    if (type.isNumber() || type.isNumberLiteral()) {
        return { type: 'number', control: 'number' };
    }

    // String (non-union)
    if (type.isString()) {
        return { type: 'string', control: 'text' };
    }

    // String literal (single value)
    if (type.isStringLiteral()) {
        return { type: 'string', control: 'text' };
    }

    // Union type — could be string union ('sm' | 'md') or mixed
    if (type.isUnion()) {
        const unionTypes = type.getUnionTypes();

        // Filter out undefined/null from optional props
        const meaningful = unionTypes.filter(t => !t.isUndefined() && !t.isNull());

        // Check if all meaningful types are string literals → enum
        const stringLiterals = meaningful.filter(t => t.isStringLiteral());
        if (stringLiterals.length === meaningful.length && stringLiterals.length > 0) {
            const options = stringLiterals.map(t => t.getLiteralValue() as string);
            return { type: 'enum', options, control: 'select' };
        }

        // Check if it's a boolean union (true | false) — common after resolution
        const boolLiterals = meaningful.filter(t => t.isBooleanLiteral());
        if (boolLiterals.length === meaningful.length && boolLiterals.length > 0) {
            return { type: 'boolean', control: 'boolean' };
        }

        // Mixed union — treat based on majority
        if (meaningful.some(t => t.isString() || t.isStringLiteral())) {
            return { type: 'string', control: 'text' };
        }

        return { type: 'string', control: 'text' };
    }

    // Array
    if (type.isArray()) {
        return { type: 'array', control: 'json' };
    }

    // Function (callbacks)
    if (type.getCallSignatures().length > 0) {
        return { type: 'function', control: 'none' };
    }

    // ReactNode / ReactElement
    const typeText = type.getText();
    if (typeText.includes('ReactNode') || typeText.includes('ReactElement') || typeText.includes('Element')) {
        return { type: 'reactnode', control: 'slot' };
    }

    // Object / unknown
    if (type.isObject()) {
        return { type: 'object', control: 'json' };
    }

    // Default
    return { type: 'string', control: 'text' };
}

/**
 * Clear the project cache (e.g., when switching repos).
 */
export function clearASTCache(): void {
    projectCache.clear();
}
