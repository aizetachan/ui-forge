import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { extractPropDefsFromAST, clearASTCache } from './astParser.js';
export class RepoParser {
    tokenCounter = 0;
    componentCounter = 0;
    manifest = null;
    /**
     * Parse repository contents for components and tokens
     * First looks for forgecore.json manifest, falls back to heuristics
     */
    async parseRepository(repoPath) {
        this.tokenCounter = 0;
        this.componentCounter = 0;
        this.manifest = null;
        // Clear AST cache when parsing a new repository
        clearASTCache();
        // Try to load forgecore.json manifest
        this.manifest = await this.loadManifest(repoPath);
        let components;
        let tokens;
        let themeCSS;
        if (this.manifest) {
            const version = this.manifest.version || this.manifest.package?.version || 'unknown';
            console.log(`[RepoParser] Using manifest: "${this.manifest.name}" v${version}`);
            components = await this.parseComponentsFromManifest(repoPath, this.manifest);
            tokens = await this.parseTokensFromManifest(repoPath, this.manifest);
            themeCSS = await this.loadThemeCSSFromManifest(repoPath, this.manifest);
        }
        else {
            console.log('[RepoParser] No forgecore.json found, using heuristics');
            components = await this.parseComponents(repoPath);
            tokens = await this.parseTokens(repoPath);
            themeCSS = await this.loadThemeCSS(repoPath);
        }
        console.log(`[RepoParser] Parsed ${components.length} components, ${tokens.length} tokens`);
        // Extract utilities and aliases for sandbox stubs
        const utilities = this.manifest?.utilities;
        const aliases = this.manifest?.runtime?.aliases || this.manifest?.aliases;
        const runtime = this.manifest?.runtime;
        const preview = this.manifest?.preview;
        if (utilities) {
            console.log(`[RepoParser] Found utilities:`, Object.keys(utilities).join(', '));
        }
        if (aliases) {
            console.log(`[RepoParser] Found aliases:`, Object.keys(aliases).join(', '));
        }
        if (preview) {
            console.log(`[RepoParser] Found preview config:`, JSON.stringify(preview.behavior || {}).slice(0, 80));
        }
        // Collect assets (icons & images) from the repository
        const repoAssets = await this.collectAssets(repoPath);
        if (repoAssets) {
            console.log(`[RepoParser] Found ${repoAssets.icons.length} icons, ${repoAssets.images.length} images`);
        }
        return { components, tokens, themeCSS, utilities, aliases, runtime, preview, repoAssets };
    }
    /**
     * Load and parse forgecore.json manifest
     */
    async loadManifest(repoPath) {
        const manifestPath = path.join(repoPath, 'forgecore.json');
        try {
            const content = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(content);
            return manifest;
        }
        catch {
            return null;
        }
    }
    /**
     * Parse components using the forgecore.json manifest
     */
    async parseComponentsFromManifest(repoPath, manifest) {
        const components = [];
        for (const [name, config] of Object.entries(manifest.components)) {
            try {
                const component = await this.parseComponentFromManifestEntry(repoPath, name, config, manifest);
                if (component) {
                    components.push(component);
                }
            }
            catch (error) {
                console.error(`[RepoParser] Failed to parse component ${name}:`, error);
            }
        }
        return components;
    }
    /**
     * Parse a single component from manifest entry
     */
    async parseComponentFromManifestEntry(repoPath, name, config, manifest) {
        const entryPath = path.join(repoPath, config.entry);
        // Read component source code
        let sourceCode;
        try {
            sourceCode = await fs.readFile(entryPath, 'utf-8');
        }
        catch {
            return null;
        }
        // Note: Dependencies (like cn.ts) are NOT loaded here
        // The stubs in esbuildCompiler.ts provide cn, clsx, styles, etc.
        // This avoids duplicate declarations when compiling
        // Read CSS and namespace class selectors to prevent collisions
        // e.g., .primary → .Button_primary (matches per-component proxy in sandbox)
        let rawCSS = '';
        const stylePaths = Array.isArray(config.styles) ? config.styles : (config.styles ? [config.styles] : []);
        for (const stylePath of stylePaths) {
            try {
                const fullPath = path.join(repoPath, stylePath);
                const css = await fs.readFile(fullPath, 'utf-8');
                // Namespace CSS classes with component name to match sandbox proxy
                const namespacedCSS = this.transformCssModuleToGlobal(css, name);
                rawCSS += namespacedCSS + '\n';
            }
            catch {
                // CSS file not found, continue without it
            }
        }
        // Note: Dependency CSS is NOT loaded here anymore.
        // It is gathered recursively by ReactSandbox.tsx during LOAD_COMPONENT
        // so that component.rawCSS stays pure for PropertiesPanel edits.
        // Extract variants from manifest
        const variants = [];
        if (config.variants) {
            for (const v of config.variants) {
                for (const value of v.values) {
                    const variantType = v.prop === 'size' ? 'size' : 'variant';
                    variants.push({
                        name: value.charAt(0).toUpperCase() + value.slice(1),
                        type: variantType,
                        cssClass: value,
                        isDefault: v.default ? v.default === value : v.values[0] === value
                    });
                }
            }
        }
        // Build propDefs - use manifest if present, otherwise derive from variants + defaultProps
        let propDefs = [];
        // PRIORITY 1: Use explicit propDefs from manifest (Phase 2 - manifest-only mode)
        if (config.propDefs && config.propDefs.length > 0) {
            propDefs = config.propDefs.map(pd => ({
                name: pd.name,
                type: pd.type,
                options: pd.options,
                defaultValue: pd.defaultValue
            }));
            console.log(`[RepoParser] Using explicit propDefs for ${name}:`, propDefs.length);
        }
        // PRIORITY 2: Build from variants
        else if (config.variants) {
            for (const v of config.variants) {
                propDefs.push({
                    name: v.prop,
                    type: 'enum',
                    options: v.values,
                    defaultValue: v.default || v.values[0]
                });
            }
        }
        // PRIORITY 3: Infer additional propDefs from defaultProps (NEW)
        // This captures props like label, placeholder, disabled, min, max, etc.
        if (config.defaultProps) {
            const existingPropNames = new Set(propDefs.map(pd => pd.name));
            const SKIP_PROPS = ['className', 'style', 'ref', 'key'];
            for (const [propName, propValue] of Object.entries(config.defaultProps)) {
                // Skip if already defined from variants or explicit propDefs
                if (existingPropNames.has(propName))
                    continue;
                // Skip internal React props
                if (SKIP_PROPS.includes(propName))
                    continue;
                const inferredType = this.inferPropTypeFromValue(propName, propValue);
                propDefs.push({
                    name: propName,
                    type: inferredType.type,
                    control: inferredType.control,
                    options: inferredType.options,
                    defaultValue: propValue
                });
            }
        }
        // PRIORITY 4: Merge TypeScript-extracted propDefs from the component interface
        // This captures boolean props (isLoading, fullWidth, iconOnly) and ReactNode props
        // (leftIcon, rightIcon) that forgecore.json doesn't declare but the TS interface does.
        // Uses AST analysis (ts-morph) first, falls back to Regex if AST fails.
        {
            let tsPropDefs = [];
            // Try AST-based extraction first (accurate type resolution)
            try {
                tsPropDefs = await extractPropDefsFromAST(entryPath, name, repoPath);
            }
            catch (astErr) {
                console.warn(`[RepoParser] AST extraction failed for ${name}:`, astErr.message);
            }
            // Fallback to Regex if AST returned nothing
            if (tsPropDefs.length === 0) {
                console.log(`[RepoParser] Using Regex fallback for ${name} propDefs`);
                tsPropDefs = this.extractPropDefinitions(sourceCode, name);
            }
            const existingPropNames = new Set(propDefs.map(pd => pd.name));
            const SKIP_PROPS = ['className', 'style', 'ref', 'key'];
            let mergedCount = 0;
            for (const tsPd of tsPropDefs) {
                if (existingPropNames.has(tsPd.name))
                    continue;
                if (SKIP_PROPS.includes(tsPd.name))
                    continue;
                propDefs.push(tsPd);
                mergedCount++;
            }
            console.log(`[RepoParser] PRIORITY 4 for ${name}: extracted ${tsPropDefs.length}, merged ${mergedCount} new. Total propDefs: ${propDefs.length}`);
            console.log(`[RepoParser] ${name} propDef types:`, propDefs.map(pd => `${pd.name}:${pd.type}`).join(', '));
        }
        this.componentCounter++;
        // Note: We do NOT concatenate dependencies here
        // The stubs in esbuildCompiler provide cn, clsx, styles, etc.
        // This avoids duplicate declarations
        // Debug: log showcase extraction
        if (name === 'Card') {
            console.log(`[RepoParser] Card config.forge =`, JSON.stringify(config.forge));
            console.log(`[RepoParser] Card config keys =`, Object.keys(config));
        }
        if (config.forge?.showcase) {
            console.log(`[RepoParser] ✅ Showcase for ${name}:`, config.forge.showcase.substring(0, 80));
        }
        return {
            id: `component-${this.componentCounter}`,
            name,
            tagName: name.toLowerCase(),
            classes: '',
            content: config.defaultProps?.children || name,
            sourceCode,
            props: config.defaultProps || {},
            filePath: entryPath,
            forgecorePath: path.join(repoPath, 'forgecore.json'),
            importPath: `@repo/${config.entry.replace(/\.tsx?$/, '')}`,
            dependencies: config.dependencies || [],
            variants,
            cssModulePath: stylePaths[0] ? path.join(repoPath, stylePaths[0]) : undefined,
            rawCSS,
            propDefs,
            // Enhanced schema fields
            componentType: config.type,
            model: config.model ? {
                pattern: config.model.pattern || 'uncontrolled',
                events: config.model.events || [],
            } : undefined,
            forgeConfig: config.forge,
            previewConfig: config.preview ? {
                ...config.preview,
                wrapperStyle: config.preview.wrapperStyle,
            } : undefined,
            showcase: config.forge?.showcase,
            // Element props that should be auto-wrapped as React elements
            elementProps: config.elementProps,
            // Callback prop names that should be auto-stubbed with no-ops
            callbacks: config.callbacks,
        };
    }
    /**
     * Infer prop type from a runtime value in defaultProps
     * Used to generate propDefs for the Properties Panel
     */
    inferPropTypeFromValue(propName, value) {
        // Handle null/undefined
        if (value === null || value === undefined) {
            return { type: 'string', control: 'text' };
        }
        // Type checks
        if (typeof value === 'boolean') {
            return { type: 'boolean', control: 'boolean' };
        }
        if (typeof value === 'number') {
            return { type: 'number', control: 'number' };
        }
        if (Array.isArray(value)) {
            return { type: 'array', control: 'json' };
        }
        if (typeof value === 'function') {
            return { type: 'function', control: 'none' };
        }
        if (typeof value === 'object') {
            return { type: 'object', control: 'json' };
        }
        // Default to string
        return { type: 'string', control: 'text' };
    }
    /**
     * Parse tokens from manifest
     */
    async parseTokensFromManifest(repoPath, manifest) {
        const tokens = [];
        // Get CSS paths from tokens.css or runtime.globalCss
        const cssPaths = manifest.tokens?.css || manifest.runtime?.globalCss || [];
        const categories = manifest.tokens?.categories;
        // Parse CSS files for CSS variables
        for (const cssPath of cssPaths) {
            try {
                const fullPath = path.join(repoPath, cssPath);
                const content = await fs.readFile(fullPath, 'utf-8');
                const cssTokens = this.extractCSSVariables(content, categories);
                tokens.push(...cssTokens);
            }
            catch (err) {
                console.warn(`[RepoParser] Could not load token file: ${cssPath}`);
            }
        }
        return tokens;
    }
    /**
     * Extract CSS variables from content with category classification
     */
    extractCSSVariables(content, categories) {
        const tokens = [];
        const varRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
        let match;
        while ((match = varRegex.exec(content)) !== null) {
            const name = `--${match[1]}`;
            const value = match[2].trim();
            // Determine type based on categories or fallback to heuristics
            let type = 'color';
            if (categories) {
                for (const [cat, prefix] of Object.entries(categories)) {
                    if (name.startsWith(prefix)) {
                        type = cat;
                        break;
                    }
                }
            }
            else {
                // Fallback heuristics
                if (name.includes('space') || name.includes('gap') || name.includes('margin') || name.includes('padding')) {
                    type = 'spacing';
                }
                else if (name.includes('font') || name.includes('text') || name.includes('line-height')) {
                    type = 'typography';
                }
                else if (name.includes('radius') || name.includes('rounded')) {
                    type = 'radius';
                }
            }
            this.tokenCounter++;
            tokens.push({
                id: `token-${this.tokenCounter}`,
                name,
                value,
                type
            });
        }
        return tokens;
    }
    /**
     * Load theme CSS from manifest
     */
    async loadThemeCSSFromManifest(repoPath, manifest) {
        // Get CSS paths from tokens.css OR runtime.globalCss (new format)
        const cssPaths = manifest.tokens?.css || manifest.runtime?.globalCss || [];
        if (cssPaths.length === 0)
            return undefined;
        let combinedCSS = '';
        for (const cssPath of cssPaths) {
            try {
                const fullPath = path.join(repoPath, cssPath);
                const content = await fs.readFile(fullPath, 'utf-8');
                combinedCSS += `\n/* ${cssPath} */\n${content}\n`;
            }
            catch (err) {
                console.warn(`[RepoParser] Could not load theme CSS: ${cssPath}`);
            }
        }
        return combinedCSS.length > 0 ? combinedCSS : undefined;
    }
    /**
     * Load theme CSS files (CSS variables)
     */
    async loadThemeCSS(repoPath) {
        console.log('[loadThemeCSS] Looking for CSS in:', repoPath);
        // globals.css MUST come first - it defines base tokens (spacing, typography, radius)
        // Theme files come after - they define color variables that may reference base tokens
        const themePatterns = [
            'src/styles/globals.css', // Base tokens: spacing, font, radius
            'src/styles/index.css', // Additional global styles
            'src/styles/themes/dark.css', // Color tokens for dark theme
            'src/styles/themes/light.css', // Color tokens for light theme (optional)
        ];
        let combinedCSS = '';
        for (const pattern of themePatterns) {
            try {
                const filePath = path.join(repoPath, pattern);
                console.log('[loadThemeCSS] Trying:', filePath);
                const content = await fs.readFile(filePath, 'utf-8');
                console.log('[loadThemeCSS] Found:', pattern, 'length:', content.length);
                combinedCSS += `\n/* ${pattern} */\n${content}\n`;
            }
            catch (err) {
                console.log('[loadThemeCSS] Not found:', pattern);
            }
        }
        console.log('[loadThemeCSS] Combined CSS length:', combinedCSS.length);
        return combinedCSS.length > 0 ? combinedCSS : undefined;
    }
    /**
     * Find and parse React components from .tsx files
     */
    async parseComponents(repoPath) {
        const components = [];
        // Look for component files in common locations
        const patterns = [
            'src/components/**/*.tsx',
            'components/**/*.tsx',
        ];
        const files = [];
        for (const pattern of patterns) {
            try {
                const found = await glob(pattern, {
                    cwd: repoPath,
                    ignore: [
                        '**/node_modules/**',
                        '**/*.test.tsx',
                        '**/*.spec.tsx',
                        '**/*.stories.tsx',
                        '**/index.tsx', // Skip barrel exports
                        '**/*.types.tsx'
                    ]
                });
                files.push(...found);
            }
            catch {
                // Pattern didn't match, continue
            }
        }
        // Remove duplicates and filter to component files only
        const uniqueFiles = [...new Set(files)].filter(f => {
            const baseName = path.basename(f, '.tsx');
            // Component files typically start with uppercase
            return /^[A-Z]/.test(baseName);
        });
        for (const file of uniqueFiles) {
            try {
                const fullPath = path.join(repoPath, file);
                const content = await fs.readFile(fullPath, 'utf-8');
                const parsed = await this.parseComponentFile(content, file, fullPath, repoPath);
                if (parsed) {
                    components.push(parsed);
                }
            }
            catch (error) {
                console.error(`Failed to parse component: ${file}`, error);
            }
        }
        return components;
    }
    /**
     * Parse a single component file to extract component info
     */
    async parseComponentFile(content, fileName, fullPath, repoPath) {
        // Extract component name from file or export
        const componentName = this.extractComponentName(content, fileName);
        if (!componentName)
            return null;
        // Detect primary HTML tag
        const tagName = this.detectPrimaryTag(content);
        // Extract text content if simple component
        const textContent = this.extractTextContent(content, componentName);
        // Find associated CSS module and extract variants
        const cssModuleInfo = await this.extractCssModuleInfo(content, fullPath, repoPath);
        // Extract props definitions (types, enums, defaults)
        const propDefs = this.extractPropDefinitions(content, componentName);
        // Calculate import path relative to repo src
        const relativePath = fullPath.replace(repoPath, '').replace(/^\//, '');
        const importPath = '@repo/' + relativePath.replace(/\.tsx?$/, '');
        // Extract internal component dependencies
        const dependencies = this.extractDependencies(content, repoPath);
        // Try to parse story variants
        const storyVariants = await this.parseStoryVariants(fullPath);
        this.componentCounter++;
        return {
            id: `comp-${componentName.toLowerCase()}-${this.componentCounter}`,
            name: componentName,
            tagName: tagName,
            classes: cssModuleInfo.baseClasses,
            content: textContent,
            sourceCode: content, // Pass full source code for runtime rendering
            props: this.extractProps(content),
            propDefs: propDefs,
            filePath: fullPath,
            importPath: importPath,
            dependencies: dependencies,
            storyVariants: storyVariants,
            variants: cssModuleInfo.variants,
            cssModulePath: cssModuleInfo.cssPath || undefined,
            rawCSS: cssModuleInfo.rawCSS
        };
    }
    /**
     * Helper to find the props destructuring block in the component
     * Supports:
     * - const Comp = ({ a, b }) => ...
     * - const Comp = React.forwardRef(({ a, b }, ref) => ...
     */
    findDestructuredProps(content) {
        // 1. Try forwardRef pattern: React.forwardRef(( { ... }, ref ) =>
        // Match starting from forwardRef until the props object
        // We match explicitly until 'ref' to ensure we have the props object
        const forwardRefRegex = /React\.forwardRef(?:<[^>]+>)?\s*\(\s*(?:async\s*)?\(\s*(\{[\s\S]*?\})\s*,\s*ref/;
        const forwardRefMatch = content.match(forwardRefRegex);
        if (forwardRefMatch) {
            return forwardRefMatch[1];
        }
        // 2. Try standard arrow function: const Comp = ({ ... }) =>
        // We look for export const ... = ({ types }) =>
        const arrowFuncRegex = /=\s*(?:async\s*)?\(\s*(\{[\s\S]*?\})\s*\)\s*=>/;
        const arrowMatch = content.match(arrowFuncRegex);
        if (arrowMatch) {
            return arrowMatch[1];
        }
        // 3. Try standard function: function Comp({ ... })
        const funcRegex = /function\s+\w+\s*\(\s*(\{[\s\S]*?\})\s*\)/;
        const funcMatch = content.match(funcRegex);
        if (funcMatch) {
            return funcMatch[1];
        }
        return null;
    }
    /**
     * Extract property definitions from TypeScript interface
     */
    extractPropDefinitions(content, componentName) {
        const propDefs = [];
        const extractedPropsText = this.findDestructuredProps(content);
        // 1. Find the props interface name
        // Try simple naming convention first (most reliable in this repo)
        let interfaceName = `${componentName}Props`;
        // If not found, try to extract from forwardRef definition
        // Match forwardRef<Type, PropsType> or forwardRef<Type>
        if (!content.includes(`interface ${interfaceName}`)) {
            const genericMatch = content.match(new RegExp(`export const ${componentName}.*<([^>]+)>`, 's'));
            if (genericMatch) {
                const parts = genericMatch[1].split(',').map(p => p.trim());
                if (parts.length > 1) {
                    interfaceName = parts[1]; // Second arg is typically props
                }
                else {
                    // Start heuristic: if only one arg, check if it ends with Props
                    const firstPart = parts[0];
                    if (firstPart.endsWith('Props')) {
                        interfaceName = firstPart;
                    }
                }
            }
        }
        // 2. Extract interface definition
        // Handles "interface Props extends ..."
        // We match until the start of the body block '{'
        const interfaceStartRegex = new RegExp(`interface\\s+${interfaceName}[^{]*\\{`, 's');
        const startMatch = content.match(interfaceStartRegex);
        if (startMatch) {
            // Find the closing brace for this interface block
            // This is a naive bracket counter, but sufficient for standard files
            const startIndex = startMatch.index + startMatch[0].length;
            let bracketCount = 1;
            let endIndex = startIndex;
            while (bracketCount > 0 && endIndex < content.length) {
                if (content[endIndex] === '{')
                    bracketCount++;
                if (content[endIndex] === '}')
                    bracketCount--;
                endIndex++;
            }
            const propsBody = content.substring(startIndex, endIndex - 1);
            // Parse each property line
            // Matches: name?: type;
            const lines = propsBody.split('\n');
            for (const line of lines) {
                // Ignore comments
                if (line.trim().startsWith('//') || line.trim().startsWith('/*'))
                    continue;
                const match = line.match(/^\s*(\w+)\??\s*:\s*([^;]+);/);
                if (match) {
                    const name = match[1];
                    let typeRaw = match[2].trim();
                    let type = 'string';
                    let options;
                    // Resolve Type References (e.g. CardVariant)
                    if (/^[A-Z]\w+$/.test(typeRaw)) {
                        const typeDefMatch = content.match(new RegExp(`type\\s+${typeRaw}\\s*=\s*([^;]+);`));
                        if (typeDefMatch) {
                            typeRaw = typeDefMatch[1];
                        }
                    }
                    // Determine Type
                    if (typeRaw === 'boolean') {
                        type = 'boolean';
                    }
                    else if (typeRaw.includes('|')) {
                        // Union literal types (enums): 'sm' | 'md'
                        const parts = typeRaw.split('|').map(p => p.trim().replace(/^['"]|['"]$/g, ''));
                        // Check if it looks like a string union or type union
                        // Filter out non-string/non-numeric parts (like 'null' or complex types)
                        const validOptions = parts.filter(p => /^[\w-]+$/.test(p));
                        if (validOptions.length > 0) {
                            type = 'enum';
                            options = validOptions;
                        }
                    }
                    else if (typeRaw === 'number') {
                        type = 'number';
                    }
                    else if (typeRaw.endsWith('[]')) {
                        // Array type: e.g., BreadcrumbItem[], string[]
                        type = 'array';
                    }
                    else if (typeRaw.includes('=>') || typeRaw.startsWith('(')) {
                        // Function type: e.g., () => void, (value: T) => void
                        type = 'function';
                    }
                    else if (typeRaw.includes('React.ReactNode') || typeRaw === 'ReactNode') {
                        type = 'reactnode';
                    }
                    else if (typeRaw.includes('React.ReactElement') || typeRaw === 'ReactElement') {
                        type = 'reactelement';
                    }
                    // Extract default value from destructured props in the component function
                    let defaultValue = undefined;
                    if (extractedPropsText) {
                        // Look for: name = value inside the destructuring block
                        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const defaultRegex = new RegExp(`\\b${escapedName}\\s*=\s*([^,}\\n]+)`);
                        const defaultMatch = extractedPropsText.match(defaultRegex);
                        if (defaultMatch) {
                            defaultValue = defaultMatch[1].trim();
                        }
                    }
                    if (defaultValue === 'true')
                        defaultValue = true;
                    if (defaultValue === 'false')
                        defaultValue = false;
                    // Provide defaults for common types if not specified
                    if (defaultValue === undefined && type === 'boolean')
                        defaultValue = false;
                    if (defaultValue && typeof defaultValue === 'string' && (defaultValue.startsWith("'") || defaultValue.startsWith('"'))) {
                        defaultValue = defaultValue.replace(/^['"]|['"]$/g, '');
                    }
                    // Include all props except className (handled separately)
                    // Include children, arrays, functions, etc. for ReactSandbox to handle
                    if (name !== 'className') {
                        propDefs.push({ name, type, options, defaultValue });
                    }
                }
            }
        }
        return propDefs;
    }
    /**
     * Extract CSS module info including base classes and variants
     */
    async extractCssModuleInfo(content, tsxPath, repoPath) {
        // Find CSS module import
        const cssModuleMatch = content.match(/import\s+\w+\s+from\s+['"](.+\.module\.css)['"]/);
        if (!cssModuleMatch) {
            return { baseClasses: '', variants: [], cssPath: null };
        }
        const cssRelPath = cssModuleMatch[1];
        const cssFullPath = path.resolve(path.dirname(tsxPath), cssRelPath);
        try {
            const cssContent = await fs.readFile(cssFullPath, 'utf-8');
            // Extract base classes (from .button, .card, etc.)
            const baseClasses = this.extractBaseClassesFromCss(cssContent);
            // Extract variants (from sections marked as /* ===== VARIANTS ===== */ or similar patterns)
            const variants = this.extractVariantsFromCss(cssContent);
            // Transform CSS Module classes to be globally usable (prefix with component name)
            const componentName = path.basename(tsxPath, '.tsx');
            const rawCSS = this.transformCssModuleToGlobal(cssContent, componentName);
            return { baseClasses, variants, cssPath: cssFullPath, rawCSS };
        }
        catch {
            return { baseClasses: '', variants: [], cssPath: null };
        }
    }
    /**
     * Extract base CSS class name from CSS module
     */
    extractBaseClassesFromCss(cssContent) {
        // Find the main class definition (usually first class like .button, .card)
        // Match .className {
        const mainClassMatch = cssContent.match(/^\s*\.([a-zA-Z][a-zA-Z0-9-]*)\s*\{/m);
        return mainClassMatch ? mainClassMatch[1] : '';
    }
    /**
     * Extract variant names from CSS module
     */
    extractVariantsFromCss(cssContent) {
        const variants = [];
        // Look for variant classes after VARIANTS section or common variant names
        const variantPatterns = [
            /\.primary\s*\{/,
            /\.secondary\s*\{/,
            /\.ghost\s*\{/,
            /\.danger\s*\{/,
            /\.success\s*\{/,
            /\.warning\s*\{/,
            /\.outline\s*\{/,
            /\.outlined\s*\{/, // Added for Card
            /\.filled\s*\{/,
            /\.default\s*\{/,
            /\.elevated\s*\{/, // Added for Card
        ];
        for (const pattern of variantPatterns) {
            if (pattern.test(cssContent)) {
                const variantName = pattern.source.match(/\\\.(\w+)/)?.[1];
                if (variantName) {
                    variants.push({
                        name: variantName,
                        type: 'variant',
                        cssClass: variantName
                    });
                }
            }
        }
        // Also look for size variants
        const sizePatterns = [/\.sm\s*\{/, /\.md\s*\{/, /\.lg\s*\{/, /\.xl\s*\{/];
        for (const pattern of sizePatterns) {
            if (pattern.test(cssContent)) {
                const sizeName = pattern.source.match(/\\\.(\w+)/)?.[1];
                if (sizeName) {
                    variants.push({
                        name: `size-${sizeName}`,
                        type: 'size',
                        cssClass: sizeName
                    });
                }
            }
        }
        return variants;
    }
    /**
     * Namespace CSS Module class selectors with the component name.
     * Transforms .className → .ComponentName_className to prevent collisions
     * when multiple components' CSS is loaded in the same sandbox.
     * Leaves @keyframes names, CSS vars, pseudo-classes, and element selectors untouched.
     */
    transformCssModuleToGlobal(cssContent, componentName) {
        // Prefix class selectors: .foo → .ComponentName_foo
        // We need to handle selectors carefully:
        //   - .button:hover → .Button_button:hover (prefix the class, keep pseudo-class)
        //   - .button .icon → .Button_button .Button_icon (prefix both classes)
        //   - @keyframes spin → keep as-is (not a selector)
        //   - ::before, ::after → keep as-is (pseudo-elements)
        //   - :root, :host → keep as-is (special selectors)
        let result = cssContent;
        // Replace class selectors: matches .className but not inside @keyframes or var()
        // Pattern: dot followed by a letter/underscore/hyphen, then word chars/hyphens
        result = result.replace(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g, (match, className, offset) => {
            // Don't transform inside @keyframes declarations
            // Check if we're inside a @keyframes block by looking backwards
            const before = result.substring(Math.max(0, offset - 200), offset);
            if (/(@keyframes\s+\S+\s*\{[^}]*$)/.test(before)) {
                return match;
            }
            // Don't transform percentage-like patterns or decimal numbers
            // Check char before the dot — if it's a digit, this is a number like 0.5
            if (offset > 0 && /[0-9]/.test(result[offset - 1])) {
                return match;
            }
            // Don't transform known CSS functions/values that start with dot
            // e.g., .module in file extensions inside url()
            if (/^(module)$/.test(className)) {
                return match;
            }
            return `.${componentName}_${className}`;
        });
        return result;
    }
    /**
     * Convert CSS properties to Tailwind-like classes where possible
     */
    cssPropertiesToTailwind(cssProperties) {
        const classes = [];
        // Parse common properties
        if (cssProperties.includes('display: inline-flex') || cssProperties.includes('display:inline-flex')) {
            classes.push('inline-flex');
        }
        else if (cssProperties.includes('display: flex') || cssProperties.includes('display:flex')) {
            classes.push('flex');
        }
        if (cssProperties.includes('align-items: center')) {
            classes.push('items-center');
        }
        if (cssProperties.includes('justify-content: center')) {
            classes.push('justify-center');
        }
        if (cssProperties.includes('cursor: pointer')) {
            classes.push('cursor-pointer');
        }
        if (cssProperties.includes('user-select: none')) {
            classes.push('select-none');
        }
        if (cssProperties.includes('white-space: nowrap')) {
            classes.push('whitespace-nowrap');
        }
        if (cssProperties.includes('border: none')) {
            classes.push('border-0');
        }
        return classes.join(' ');
    }
    /**
     * Extract component name from file content or filename
     */
    extractComponentName(content, fileName) {
        // Try to find export const ComponentName = React.forwardRef
        const forwardRefMatch = content.match(/export\s+const\s+([A-Z][a-zA-Z0-9]*)\s*=\s*React\.forwardRef/);
        if (forwardRefMatch) {
            return forwardRefMatch[1];
        }
        // Try to find export const/function ComponentName
        const exportMatch = content.match(/export\s+(?:const|function)\s+([A-Z][a-zA-Z0-9]*)/);
        if (exportMatch) {
            return exportMatch[1];
        }
        // Try default export
        const defaultMatch = content.match(/export\s+default\s+(?:function\s+)?([A-Z][a-zA-Z0-9]*)/);
        if (defaultMatch) {
            return defaultMatch[1];
        }
        // Fall back to filename
        const baseName = path.basename(fileName, '.tsx');
        if (/^[A-Z]/.test(baseName)) {
            return baseName;
        }
        return null;
    }
    /**
     * Detect the primary HTML tag used in the component
     */
    detectPrimaryTag(content) {
        // Look for return statement with JSX
        const returnMatch = content.match(/return\s*\(\s*<(\w+)/);
        if (returnMatch) {
            const tag = returnMatch[1].toLowerCase();
            const validTags = ['button', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'input', 'a', 'label', 'section', 'article'];
            return validTags.includes(tag) ? tag : 'div';
        }
        return 'div';
    }
    /**
     * Extract simple text content from component
     */
    extractTextContent(content, componentName) {
        // Look for children prop or default content
        const childrenMatch = content.match(/{children}/);
        if (childrenMatch) {
            return componentName; // Use component name as placeholder
        }
        // Look for hardcoded text
        const textMatch = content.match(/<[^>]+>([^<{]+)</);
        if (textMatch && textMatch[1].trim() && textMatch[1].trim().length < 50) {
            return textMatch[1].trim();
        }
        return componentName;
    }
    /**
     * Extract props interface from component - simplified to avoid capturing TypeScript types
     */
    extractProps(content) {
        const props = {};
        const propsDestructuring = this.findDestructuredProps(content);
        if (propsDestructuring) {
            // Look for boolean defaults like disabled = false
            const booleanDefaults = propsDestructuring.matchAll(/(\w+)\s*=\s*(true|false)/g);
            for (const match of booleanDefaults) {
                const propName = match[1].toLowerCase();
                // Only allow safe DOM props
                if (['disabled', 'autofocus', 'readonly', 'required', 'checked'].includes(propName)) {
                    props[propName] = match[2] === 'true';
                }
            }
        }
        return props;
    }
    /**
     * Extract internal component dependencies from imports
     */
    extractDependencies(content, repoPath) {
        const dependencies = [];
        // Match relative imports from components
        // e.g., import { Button } from '../Button'
        // e.g., import { Spinner } from '@/components/Spinner'
        const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[2];
            // Check if it's an internal component import
            if (importPath.startsWith('./') ||
                importPath.startsWith('../') ||
                importPath.startsWith('@/') ||
                importPath.startsWith('@repo/')) {
                // Extract component names from the import
                const imported = match[1].split(',').map(s => s.trim());
                for (const imp of imported) {
                    // Skip non-component imports (lowercase start or type imports)
                    const name = imp.replace(/\s+as\s+\w+/, '').trim();
                    if (name && /^[A-Z]/.test(name)) {
                        dependencies.push(name);
                    }
                }
            }
        }
        return [...new Set(dependencies)]; // Remove duplicates
    }
    /**
     * Parse story variants from .stories.tsx file
     */
    async parseStoryVariants(componentPath) {
        const variants = [];
        // Look for .stories.tsx file next to the component
        const storyPath = componentPath.replace(/\.tsx$/, '.stories.tsx');
        try {
            const storyContent = await fs.readFile(storyPath, 'utf-8');
            // Match exported story constants
            // e.g., export const Primary: Story = { ... }
            // e.g., export const Default = { ... }
            const storyRegex = /export\s+const\s+(\w+)(?::\s*Story)?\s*=\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
            let match;
            while ((match = storyRegex.exec(storyContent)) !== null) {
                const storyName = match[1];
                const storyBody = match[2];
                // Skip meta export
                if (storyName === 'meta' || storyName === 'default')
                    continue;
                const variant = {
                    name: storyName,
                    hasRender: storyBody.includes('render:'),
                };
                // Try to extract args
                const argsMatch = storyBody.match(/args\s*:\s*\{([^}]+)\}/);
                if (argsMatch) {
                    try {
                        // Simple key: value extraction (not full eval)
                        const argsStr = argsMatch[1];
                        const args = {};
                        // Match simple key: value pairs
                        const pairRegex = /(\w+)\s*:\s*(?:'([^']*)'|"([^"]*)"|(\d+)|(\w+))/g;
                        let pairMatch;
                        while ((pairMatch = pairRegex.exec(argsStr)) !== null) {
                            const key = pairMatch[1];
                            const value = pairMatch[2] || pairMatch[3] ||
                                (pairMatch[4] ? parseInt(pairMatch[4]) : null) ||
                                (pairMatch[5] === 'true' ? true :
                                    pairMatch[5] === 'false' ? false : pairMatch[5]);
                            if (value !== null) {
                                args[key] = value;
                            }
                        }
                        if (Object.keys(args).length > 0) {
                            variant.args = args;
                        }
                    }
                    catch {
                        // Ignore parsing errors
                    }
                }
                variants.push(variant);
            }
        }
        catch {
            // No story file or can't read it - this is normal
        }
        return variants;
    }
    /**
     * Parse design tokens from various sources
     */
    async parseTokens(repoPath) {
        const tokens = [];
        // Primary source: theme CSS files with CSS variables
        const themeTokens = await this.parseThemeCss(repoPath);
        tokens.push(...themeTokens);
        // Fallback: try tokens.json
        if (tokens.length === 0) {
            const jsonTokens = await this.parseJsonTokens(repoPath);
            tokens.push(...jsonTokens);
        }
        // Fallback: try normal CSS with :root
        if (tokens.length === 0) {
            const cssTokens = await this.parseCssTokens(repoPath);
            tokens.push(...cssTokens);
        }
        return tokens;
    }
    /**
     * Parse tokens from theme CSS files (like GenDS structure)
     */
    async parseThemeCss(repoPath) {
        const tokens = [];
        const seenTokens = new Set(); // Avoid duplicates
        // Look for theme files AND globals with CSS variables
        const cssFiles = [
            'src/styles/globals.css', // Spacing, typography, radius tokens
            'src/styles/themes/dark.css', // Color tokens
            'src/styles/themes/light.css',
            'styles/globals.css',
            'src/index.css',
        ];
        for (const file of cssFiles) {
            try {
                const filePath = path.join(repoPath, file);
                const content = await fs.readFile(filePath, 'utf-8');
                // Parse all CSS custom properties
                const varMatches = content.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g);
                for (const match of varMatches) {
                    const name = match[1];
                    const value = match[2].trim();
                    // Skip duplicates
                    if (seenTokens.has(name))
                        continue;
                    seenTokens.add(name);
                    // Skip non-design tokens (transitions, z-index)
                    if (name.includes('duration') || name.includes('ease') ||
                        name.includes('z-') || name.includes('opacity')) {
                        continue;
                    }
                    this.tokenCounter++;
                    tokens.push({
                        id: `tok-${this.tokenCounter}`,
                        name: name,
                        value: value,
                        type: this.inferTokenType(name, value)
                    });
                }
            }
            catch {
                // File doesn't exist, continue
            }
        }
        return tokens;
    }
    /**
     * Parse tokens from JSON files
     */
    async parseJsonTokens(repoPath) {
        const tokens = [];
        const possibleFiles = ['tokens.json', 'design-tokens.json', 'src/tokens.json'];
        for (const file of possibleFiles) {
            try {
                const filePath = path.join(repoPath, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const data = JSON.parse(content);
                this.parseJsonTokensRecursive(data, '', tokens);
                if (tokens.length > 0)
                    break;
            }
            catch {
                // File doesn't exist or parse error
            }
        }
        return tokens;
    }
    /**
     * Recursively parse nested token objects
     */
    parseJsonTokensRecursive(obj, prefix, tokens) {
        for (const [key, value] of Object.entries(obj)) {
            const tokenName = prefix ? `${prefix}-${key}` : key;
            if (typeof value === 'string') {
                this.tokenCounter++;
                tokens.push({
                    id: `tok-${this.tokenCounter}`,
                    name: tokenName,
                    value: value,
                    type: this.inferTokenType(tokenName, value)
                });
            }
            else if (typeof value === 'object' && value !== null) {
                this.parseJsonTokensRecursive(value, tokenName, tokens);
            }
        }
    }
    /**
     * Parse CSS custom properties from CSS files
     */
    async parseCssTokens(repoPath) {
        const tokens = [];
        const cssFiles = ['src/index.css', 'src/globals.css', 'styles/globals.css', 'app/globals.css'];
        for (const file of cssFiles) {
            try {
                const filePath = path.join(repoPath, file);
                const content = await fs.readFile(filePath, 'utf-8');
                // Find all CSS custom properties in :root or [data-theme]
                const varMatches = content.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g);
                for (const match of varMatches) {
                    this.tokenCounter++;
                    tokens.push({
                        id: `tok-${this.tokenCounter}`,
                        name: match[1],
                        value: match[2].trim(),
                        type: this.inferTokenType(match[1], match[2].trim())
                    });
                }
                if (tokens.length > 0)
                    break;
            }
            catch {
                // File doesn't exist
            }
        }
        return tokens;
    }
    /**
     * Infer token type from name and value
     */
    inferTokenType(name, value) {
        const nameLower = name.toLowerCase();
        // Radius detection - must come before color (some radius have 'border' in name)
        if (nameLower.includes('radius') || nameLower.includes('rounded')) {
            return 'radius';
        }
        // Typography detection
        if (nameLower.includes('font') || nameLower.includes('line-height') ||
            nameLower.includes('letter-spacing') ||
            (nameLower.includes('size') && !nameLower.includes('space'))) {
            return 'typography';
        }
        // Spacing detection
        if (nameLower.includes('space') || nameLower.includes('gap') ||
            nameLower.includes('margin') || nameLower.includes('padding')) {
            return 'spacing';
        }
        // Color detection (check after others since 'bg', 'text', 'border' are common)
        if (nameLower.includes('color') || nameLower.includes('bg-') ||
            nameLower.includes('-bg') || nameLower.includes('shadow') ||
            (nameLower.includes('text') && (nameLower.includes('color') || value.startsWith('#'))) ||
            (nameLower.includes('border') && !nameLower.includes('radius')) ||
            value.startsWith('#') || value.includes('rgb') || value.includes('hsl') || value.includes('rgba')) {
            return 'color';
        }
        // Default by value patterns
        if (value.endsWith('rem') || value.endsWith('px') || /^\d+$/.test(value)) {
            return 'spacing';
        }
        return 'color';
    }
    // ═══════════════════════════════════════════════════════════════════
    // ASSET COLLECTION (icons & images)
    // ═══════════════════════════════════════════════════════════════════
    /**
     * Collect SVG icons and image assets from the repository.
     * Checks manifest config first, then falls back to scanning common directories.
     */
    async collectAssets(repoPath) {
        const icons = [];
        const images = [];
        // Determine icon paths from manifest or use defaults
        const iconPaths = [];
        const imagePaths = [];
        if (this.manifest?.assets?.icons?.path) {
            iconPaths.push(this.manifest.assets.icons.path);
        }
        if (this.manifest?.assets?.images) {
            imagePaths.push(this.manifest.assets.images);
        }
        // Fallback: scan common directories
        const defaultIconDirs = ['src/icons', 'src/assets/icons', 'public/icons', 'icons'];
        const defaultImageDirs = ['src/assets', 'src/images', 'public/images', 'public/assets', 'assets'];
        // Scan for SVG icons
        const iconDirs = iconPaths.length > 0 ? iconPaths : defaultIconDirs;
        for (const dir of iconDirs) {
            try {
                const fullDir = path.join(repoPath, dir);
                const stat = await fs.stat(fullDir).catch(() => null);
                if (!stat?.isDirectory())
                    continue;
                const svgFiles = await glob('**/*.svg', {
                    cwd: fullDir,
                    ignore: ['**/node_modules/**'],
                });
                for (const svgFile of svgFiles) {
                    try {
                        const svgPath = path.join(fullDir, svgFile);
                        const svgContent = await fs.readFile(svgPath, 'utf-8');
                        // Derive icon name from filename: "arrow-left.svg" → "ArrowLeft"
                        const baseName = path.basename(svgFile, '.svg');
                        const iconName = baseName
                            .split(/[-_\s]+/)
                            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                            .join('');
                        const relativePath = path.join(dir, svgFile);
                        icons.push({ name: iconName, svgContent, relativePath });
                    }
                    catch (err) {
                        // Skip unreadable SVG files
                    }
                }
                // If we found icons in a manifest-specified or default dir, don't scan further defaults
                if (icons.length > 0 && iconPaths.length === 0)
                    break;
            }
            catch {
                // Directory not found, continue
            }
        }
        // Scan for image files (png, jpg, jpeg, gif, webp, svg that aren't in icon dirs)
        const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
        const MIME_MAP = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
        };
        const imgDirs = imagePaths.length > 0 ? imagePaths : defaultImageDirs;
        for (const dir of imgDirs) {
            try {
                const fullDir = path.join(repoPath, dir);
                const stat = await fs.stat(fullDir).catch(() => null);
                if (!stat?.isDirectory())
                    continue;
                const imgPattern = '**/*.{png,jpg,jpeg,gif,webp,svg}';
                const imgFiles = await glob(imgPattern, {
                    cwd: fullDir,
                    ignore: ['**/node_modules/**'],
                });
                for (const imgFile of imgFiles) {
                    const ext = path.extname(imgFile).toLowerCase();
                    if (!IMAGE_EXTENSIONS.includes(ext))
                        continue;
                    const relativePath = path.join(dir, imgFile);
                    const name = path.basename(imgFile);
                    const mimeType = MIME_MAP[ext] || 'application/octet-stream';
                    // Avoid duplicating SVGs that were already collected as icons
                    if (ext === '.svg' && icons.some(icon => icon.relativePath === relativePath)) {
                        continue;
                    }
                    images.push({ name, relativePath, mimeType });
                }
                // If we found images in a manifest-specified or default dir, don't scan further defaults
                if (images.length > 0 && imagePaths.length === 0)
                    break;
            }
            catch {
                // Directory not found, continue
            }
        }
        // Also scan component directories for co-located images
        // e.g. src/components/Card/card-image.png
        try {
            const componentImgFiles = await glob('src/components/**/*.{png,jpg,jpeg,gif,webp}', {
                cwd: repoPath,
                ignore: ['**/node_modules/**'],
            });
            for (const imgFile of componentImgFiles) {
                const ext = path.extname(imgFile).toLowerCase();
                const name = path.basename(imgFile);
                const mimeType = MIME_MAP[ext] || 'application/octet-stream';
                // Avoid duplicates
                if (!images.some(img => img.relativePath === imgFile)) {
                    images.push({ name, relativePath: imgFile, mimeType });
                }
            }
        }
        catch {
            // No component images found
        }
        // Return null if no assets found
        if (icons.length === 0 && images.length === 0) {
            return undefined;
        }
        return { icons, images, repoPath };
    }
}
