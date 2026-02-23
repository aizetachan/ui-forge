import fs from 'fs/promises';
import path from 'path';
/**
 * PatchService handles direct file modifications
 * for CSS variables and design tokens with HMR support.
 */
export class PatchService {
    /**
     * Apply CSS variable changes to a theme file
     */
    async patchCssVariables(cssFilePath, changes) {
        try {
            let content = await fs.readFile(cssFilePath, 'utf-8');
            for (const change of changes) {
                // Match the variable declaration: --var-name: value;
                const regex = new RegExp(`(${this.escapeRegex(change.variable)}\\s*:\\s*)${this.escapeRegex(change.oldValue)}(\\s*;)`, 'g');
                content = content.replace(regex, `$1${change.newValue}$2`);
            }
            await fs.writeFile(cssFilePath, content, 'utf-8');
            return {
                success: true,
                filePath: cssFilePath,
            };
        }
        catch (error) {
            return {
                success: false,
                filePath: cssFilePath,
                error: error.message,
            };
        }
    }
    /**
     * Apply changes to a JSON tokens file
     */
    async patchJsonTokens(jsonFilePath, changes) {
        try {
            const content = await fs.readFile(jsonFilePath, 'utf-8');
            const tokens = JSON.parse(content);
            for (const change of changes) {
                this.setNestedValue(tokens, change.path, change.newValue);
            }
            await fs.writeFile(jsonFilePath, JSON.stringify(tokens, null, 2), 'utf-8');
            return {
                success: true,
                filePath: jsonFilePath,
            };
        }
        catch (error) {
            return {
                success: false,
                filePath: jsonFilePath,
                error: error.message,
            };
        }
    }
    /**
     * Apply changes to a CSS module file
     */
    async patchCssModule(cssModulePath, selector, property, newValue) {
        try {
            let content = await fs.readFile(cssModulePath, 'utf-8');
            // Find the selector block and the property within it
            const selectorRegex = new RegExp(`(\\.${this.escapeRegex(selector)}\\s*\\{[^}]*)` +
                `(${this.escapeRegex(property)}\\s*:\\s*)([^;]+)(;)`, 'g');
            content = content.replace(selectorRegex, `$1$2${newValue}$4`);
            await fs.writeFile(cssModulePath, content, 'utf-8');
            return {
                success: true,
                filePath: cssModulePath,
            };
        }
        catch (error) {
            return {
                success: false,
                filePath: cssModulePath,
                error: error.message,
            };
        }
    }
    /**
     * Read current CSS variable values from a file
     */
    async readCssVariables(cssFilePath) {
        const variables = {};
        try {
            const content = await fs.readFile(cssFilePath, 'utf-8');
            // Match CSS variable declarations
            const varRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;
            let match;
            while ((match = varRegex.exec(content)) !== null) {
                variables[match[1]] = match[2].trim();
            }
        }
        catch {
            // File doesn't exist or can't be read
        }
        return variables;
    }
    /**
     * Read current JSON token values
     */
    async readJsonTokens(jsonFilePath) {
        try {
            const content = await fs.readFile(jsonFilePath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return {};
        }
    }
    /**
     * Find theme CSS files in a repository
     */
    async findThemeFiles(repoPath) {
        const themeFiles = [];
        const candidates = [
            'src/styles/theme.css',
            'src/styles/globals.css',
            'src/styles/variables.css',
            'src/styles/tokens.css',
            'styles/theme.css',
            'styles/globals.css',
            'theme.css',
        ];
        for (const candidate of candidates) {
            const fullPath = path.join(repoPath, candidate);
            try {
                await fs.access(fullPath);
                themeFiles.push(fullPath);
            }
            catch {
                // File doesn't exist
            }
        }
        return themeFiles;
    }
    /**
     * Find token JSON files in a repository
     */
    async findTokenFiles(repoPath) {
        const tokenFiles = [];
        const candidates = [
            'tokens.json',
            'src/tokens.json',
            'design-tokens.json',
            'src/design-tokens.json',
        ];
        for (const candidate of candidates) {
            const fullPath = path.join(repoPath, candidate);
            try {
                await fs.access(fullPath);
                tokenFiles.push(fullPath);
            }
            catch {
                // File doesn't exist
            }
        }
        return tokenFiles;
    }
    // Helper methods
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    setNestedValue(obj, path, value) {
        let current = obj;
        for (let i = 0; i < path.length - 1; i++) {
            if (!(path[i] in current)) {
                current[path[i]] = {};
            }
            current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
    }
}
// Singleton instance
export const patchService = new PatchService();
