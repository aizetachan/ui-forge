import fs from 'fs/promises';
import postcss from 'postcss';
/**
 * CodeWriter — writes visual editor changes directly to repo files.
 *
 * Every edit in the PropertiesPanel calls one of these methods to immediately
 * update the file on disk. This ensures the repo is always ready for git push.
 */
export class CodeWriter {
    /**
     * Modify a CSS property within a .module.css file.
     * Finds the target selector and patches or adds the property.
     *
     * @param cssFilePath - Absolute path to the .module.css file
     * @param selector - CSS selector to target (e.g., '.button', '.button.primary')
     * @param changes - Map of CSS property → value (e.g., { 'padding': '12px 24px' })
     * @returns The updated CSS content (for updating component.rawCSS in state)
     */
    async writeCSSChange(params) {
        try {
            let content = await fs.readFile(params.cssFilePath, 'utf-8');
            // Capture previous values before patching
            const previousValues = {};
            for (const [prop] of Object.entries(params.changes)) {
                const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                previousValues[prop] = this.extractCSSPropertyValue(content, params.selector, cssProp, params.mediaQuery) || '';
            }
            for (const [prop, value] of Object.entries(params.changes)) {
                content = this.patchCSSProperty(content, params.selector, prop, value, params.mediaQuery);
            }
            await fs.writeFile(params.cssFilePath, content, 'utf-8');
            console.log(`[CodeWriter] CSS updated: ${params.cssFilePath} (${Object.keys(params.changes).join(', ')})`);
            return { success: true, newContent: content, previousValues };
        }
        catch (error) {
            console.error('[CodeWriter] CSS write failed:', error.message);
            return { success: false, newContent: '', error: error.message };
        }
    }
    /**
     * Modify a component's defaultProps in forgecore.json.
     *
     * @param forgecorePath - Absolute path to forgecore.json
     * @param componentName - Component name as key in manifest.components
     * @param propName - Property name to update
     * @param value - New value
     */
    async writePropDefault(params) {
        try {
            const content = await fs.readFile(params.forgecorePath, 'utf-8');
            const manifest = JSON.parse(content);
            // Navigate to the component's defaultProps
            if (!manifest.components?.[params.componentName]) {
                return { success: false, error: `Component "${params.componentName}" not found in forgecore.json` };
            }
            if (!manifest.components[params.componentName].defaultProps) {
                manifest.components[params.componentName].defaultProps = {};
            }
            // Capture previous value before overwriting
            const previousValue = JSON.stringify(manifest.components[params.componentName].defaultProps[params.propName] ?? '');
            manifest.components[params.componentName].defaultProps[params.propName] = params.value;
            // Write with formatting preserved (2-space indent)
            await fs.writeFile(params.forgecorePath, JSON.stringify(manifest, null, 4) + '\n', 'utf-8');
            console.log(`[CodeWriter] Prop updated: ${params.componentName}.${params.propName} = ${JSON.stringify(params.value)}`);
            return { success: true, previousValue };
        }
        catch (error) {
            console.error('[CodeWriter] Prop write failed:', error.message);
            return { success: false, error: error.message };
        }
    }
    /**
     * Modify a CSS custom property (design token) in a theme file.
     *
     * @param themeFilePath - Absolute path to CSS file containing the token
     * @param tokenName - CSS variable name without -- prefix (e.g., 'sg-color-primary')
     * @param newValue - New value for the token
     * @returns Updated theme CSS content
     */
    async writeTokenValue(params) {
        try {
            let content = await fs.readFile(params.themeFilePath, 'utf-8');
            // Match: --token-name: oldValue;
            // Handle optional whitespace and various value formats
            const varName = params.tokenName.startsWith('--') ? params.tokenName : `--${params.tokenName}`;
            const escapedVar = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedVar}\\s*:\\s*)([^;]+)(;)`, 'g');
            // Capture previous value before replacing
            let previousValue = '';
            const captureRegex = new RegExp(`${escapedVar}\\s*:\\s*([^;]+);`);
            const captureMatch = content.match(captureRegex);
            if (captureMatch) {
                previousValue = captureMatch[1].trim();
            }
            const matched = regex.test(content);
            if (!matched) {
                return { success: false, newContent: content, error: `Token "${varName}" not found in ${params.themeFilePath}` };
            }
            // Reset regex lastIndex after test
            content = content.replace(new RegExp(`(${escapedVar}\\s*:\\s*)([^;]+)(;)`, 'g'), `$1${params.newValue}$3`);
            await fs.writeFile(params.themeFilePath, content, 'utf-8');
            console.log(`[CodeWriter] Token updated: ${varName} = ${params.newValue}`);
            return { success: true, newContent: content, previousValue };
        }
        catch (error) {
            console.error('[CodeWriter] Token write failed:', error.message);
            return { success: false, newContent: '', error: error.message };
        }
    }
    // ─── Private Helpers ─────────────────────────────────────────
    /**
     * Extract the current value of a CSS property from a selector block.
     * Returns the value string or null if not found.
     */
    extractCSSPropertyValue(css, selector, cssProp, mediaQuery) {
        // Scope to @media block if needed
        let searchBase = css;
        if (mediaQuery) {
            const mediaIdx = css.indexOf(mediaQuery);
            if (mediaIdx >= 0) {
                const openBrace = css.indexOf('{', mediaIdx + mediaQuery.length);
                if (openBrace >= 0) {
                    let depth = 1;
                    let mi = openBrace + 1;
                    while (mi < css.length && depth > 0) {
                        if (css[mi] === '{')
                            depth++;
                        if (css[mi] === '}')
                            depth--;
                        if (depth > 0)
                            mi++;
                    }
                    searchBase = css.substring(openBrace + 1, mi);
                }
            }
        }
        // Find selector
        const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const selectorRegex = new RegExp(escapedSelector + '(?=[\\s{,:])');
        const selectorMatch = selectorRegex.exec(searchBase);
        if (!selectorMatch)
            return null;
        // Find the opening brace
        const openBrace = searchBase.indexOf('{', selectorMatch.index + selector.length);
        if (openBrace < 0)
            return null;
        // Find matching close brace
        let depth = 1;
        let i = openBrace + 1;
        while (i < searchBase.length && depth > 0) {
            if (searchBase[i] === '{')
                depth++;
            if (searchBase[i] === '}')
                depth--;
            if (depth > 0)
                i++;
        }
        const body = searchBase.substring(openBrace + 1, i);
        // Find the property value
        const escapedProp = cssProp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const propRegex = new RegExp(`\\s*${escapedProp}\\s*:\\s*([^;]+);`);
        const propMatch = body.match(propRegex);
        return propMatch ? propMatch[1].trim() : null;
    }
    /**
     * Patch a single CSS property within a selector block.
     * If the property exists, update it. If not, add it.
     * Uses PostCSS AST for safe, non-destructive CSS manipulation.
     */
    patchCSSProperty(css, selector, prop, value, mediaQuery) {
        // Convert camelCase to kebab-case (e.g., paddingTop → padding-top)
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        try {
            const root = postcss.parse(css);
            let found = false;
            // Walk all rules looking for matching selector
            root.walkRules((rule) => {
                if (found)
                    return;
                // Normalize whitespace for comparison
                const ruleSelector = rule.selector.replace(/\s+/g, ' ').trim();
                const targetSelector = selector.replace(/\s+/g, ' ').trim();
                if (ruleSelector !== targetSelector)
                    return;
                // E5: If mediaQuery is specified, verify the rule is inside the correct @media block
                if (mediaQuery) {
                    const parent = rule.parent;
                    if (!parent || parent.type !== 'atrule' || parent.name !== 'media')
                        return;
                    const parentParams = `@media ${parent.params}`.trim();
                    if (!parentParams.includes(mediaQuery.replace('@media ', '').trim()))
                        return;
                }
                // Found the rule — update or add the property
                let existingDecl = null;
                rule.walkDecls((decl) => {
                    if (decl.prop === cssProp) {
                        existingDecl = decl;
                    }
                });
                if (existingDecl) {
                    existingDecl.value = value;
                }
                else {
                    rule.append(postcss.decl({ prop: cssProp, value }));
                }
                found = true;
            });
            if (!found) {
                // Selector not found — create a new rule
                if (mediaQuery) {
                    let mediaBlock = null;
                    root.walkAtRules('media', (atRule) => {
                        const params = `@media ${atRule.params}`.trim();
                        if (params.includes(mediaQuery.replace('@media ', '').trim())) {
                            mediaBlock = atRule;
                        }
                    });
                    if (mediaBlock) {
                        const newRule = postcss.rule({ selector });
                        newRule.append(postcss.decl({ prop: cssProp, value }));
                        mediaBlock.append(newRule);
                    }
                    else {
                        const atRule = postcss.atRule({ name: 'media', params: mediaQuery.replace('@media ', '').trim() });
                        const newRule = postcss.rule({ selector });
                        newRule.append(postcss.decl({ prop: cssProp, value }));
                        atRule.append(newRule);
                        root.append(atRule);
                    }
                }
                else {
                    const newRule = postcss.rule({ selector });
                    newRule.append(postcss.decl({ prop: cssProp, value }));
                    root.append(newRule);
                }
            }
            return root.toString();
        }
        catch (postcssErr) {
            console.warn('[CodeWriter] PostCSS patch failed, using regex fallback:', postcssErr.message);
            return this.patchCSSPropertyRegex(css, selector, prop, value, mediaQuery);
        }
    }
    /**
     * Legacy regex-based CSS patching — used as fallback if PostCSS fails.
     */
    patchCSSPropertyRegex(css, selector, prop, value, mediaQuery) {
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        let searchBase = css;
        let mediaOffset = 0;
        let mediaOpenBrace = -1;
        let mediaCloseBrace = -1;
        if (mediaQuery) {
            const mediaIdx = css.indexOf(mediaQuery);
            if (mediaIdx >= 0) {
                mediaOpenBrace = css.indexOf('{', mediaIdx + mediaQuery.length);
                if (mediaOpenBrace >= 0) {
                    let depth = 1;
                    let mi = mediaOpenBrace + 1;
                    while (mi < css.length && depth > 0) {
                        if (css[mi] === '{')
                            depth++;
                        if (css[mi] === '}')
                            depth--;
                        if (depth > 0)
                            mi++;
                    }
                    mediaCloseBrace = mi;
                    searchBase = css.substring(mediaOpenBrace + 1, mediaCloseBrace);
                    mediaOffset = mediaOpenBrace + 1;
                }
            }
        }
        const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const selectorRegex = new RegExp(escapedSelector + '(?=[\\s{,:])');
        const selectorMatch = selectorRegex.exec(searchBase);
        const selectorIdx = selectorMatch ? selectorMatch.index : -1;
        if (selectorIdx < 0) {
            if (mediaQuery && mediaCloseBrace >= 0) {
                const indent = '  ';
                const newRule = `\n${indent}${selector} {\n${indent}${indent}${cssProp}: ${value};\n${indent}}\n`;
                return css.substring(0, mediaCloseBrace) + newRule + css.substring(mediaCloseBrace);
            }
            const newBlock = `\n${selector} {\n  ${cssProp}: ${value};\n}\n`;
            return css + newBlock;
        }
        const openBrace = searchBase.indexOf('{', selectorIdx + selector.length);
        if (openBrace < 0) {
            const newBlock = `\n${selector} {\n  ${cssProp}: ${value};\n}\n`;
            return css + newBlock;
        }
        let depth = 1;
        let i = openBrace + 1;
        while (i < searchBase.length && depth > 0) {
            if (searchBase[i] === '{')
                depth++;
            if (searchBase[i] === '}')
                depth--;
            if (depth > 0)
                i++;
        }
        const closeBrace = i;
        const body = searchBase.substring(openBrace + 1, closeBrace);
        const escapedProp = cssProp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const propRegex = new RegExp(`(\\s*${escapedProp}\\s*:\\s*)([^;]+)(;)`);
        const propMatch = body.match(propRegex);
        let newBody;
        if (propMatch) {
            newBody = body.replace(propRegex, `$1${value}$3`);
        }
        else {
            const indentMatch = body.match(/\n(\s+)\S/);
            const indent = indentMatch ? indentMatch[1] : '  ';
            newBody = body.trimEnd() + `\n${indent}${cssProp}: ${value};\n`;
        }
        const actualOpenBrace = openBrace + mediaOffset;
        const actualCloseBrace = closeBrace + mediaOffset;
        return css.substring(0, actualOpenBrace + 1) + newBody + css.substring(actualCloseBrace);
    }
}
