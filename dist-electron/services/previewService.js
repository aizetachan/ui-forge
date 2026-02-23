import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
/**
 * PreviewService manages a local Vite dev server for rendering
 * components from cloned repositories with their real dependencies.
 */
export class PreviewService extends EventEmitter {
    devServerProcess = null;
    serverInfo = null;
    logs = [];
    harnessPath = null;
    /**
     * Detect which package manager the repo uses
     */
    async detectPackageManager(repoPath) {
        try {
            // Check for lock files in order of preference
            const checks = [
                { file: 'pnpm-lock.yaml', manager: 'pnpm' },
                { file: 'yarn.lock', manager: 'yarn' },
                { file: 'package-lock.json', manager: 'npm' },
            ];
            for (const { file, manager } of checks) {
                try {
                    await fs.access(path.join(repoPath, file));
                    console.log(`[PreviewService] Detected ${manager} from ${file}`);
                    return manager;
                }
                catch {
                    // File doesn't exist, continue
                }
            }
            // Default to npm if no lock file found
            console.log('[PreviewService] No lock file found, defaulting to npm');
            return 'npm';
        }
        catch (error) {
            console.error('[PreviewService] Error detecting package manager:', error);
            return 'npm';
        }
    }
    /**
     * Install dependencies in the cloned repo
     */
    async installDependencies(repoPath) {
        const pm = await this.detectPackageManager(repoPath);
        return new Promise((resolve, reject) => {
            console.log(`[PreviewService] Installing dependencies with ${pm}...`);
            this.emit('log', `Installing dependencies with ${pm}...`);
            const installCmd = pm === 'npm' ? 'npm install' : `${pm} install`;
            const [cmd, ...args] = installCmd.split(' ');
            const proc = spawn(cmd, args, {
                cwd: repoPath,
                shell: true,
                stdio: 'pipe',
            });
            proc.stdout?.on('data', (data) => {
                const log = data.toString();
                this.logs.push(log);
                this.emit('log', log);
            });
            proc.stderr?.on('data', (data) => {
                const log = data.toString();
                this.logs.push(log);
                this.emit('log', log);
            });
            proc.on('close', (code) => {
                if (code === 0) {
                    console.log('[PreviewService] Dependencies installed successfully');
                    this.emit('log', 'Dependencies installed successfully');
                    resolve();
                }
                else {
                    const error = new Error(`Install failed with code ${code}`);
                    this.emit('error', error);
                    reject(error);
                }
            });
            proc.on('error', (error) => {
                this.emit('error', error);
                reject(error);
            });
        });
    }
    /**
     * Setup the harness project for component preview
     */
    async setupHarness(repoPath) {
        const harnessDir = path.join(repoPath, '.ui-forge', 'harness');
        this.harnessPath = harnessDir;
        console.log(`[PreviewService] Setting up harness at ${harnessDir}`);
        this.emit('log', 'Setting up preview harness...');
        // Create harness directory
        await fs.mkdir(harnessDir, { recursive: true });
        // Create package.json
        const packageJson = {
            name: 'ui-forge-harness',
            private: true,
            type: 'module',
            scripts: {
                dev: 'vite',
                build: 'vite build',
            },
            dependencies: {
                react: '^18.2.0',
                'react-dom': '^18.2.0',
            },
            devDependencies: {
                '@types/react': '^18.2.0',
                '@types/react-dom': '^18.2.0',
                '@vitejs/plugin-react': '^4.2.0',
                vite: '^5.0.0',
                typescript: '^5.0.0',
            },
        };
        await fs.writeFile(path.join(harnessDir, 'package.json'), JSON.stringify(packageJson, null, 2));
        // Create vite.config.ts with alias to repo
        const viteConfig = `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@repo': path.resolve(__dirname, '../../src'),
      '@': path.resolve(__dirname, '../../src'),
    },
  },
  server: {
    port: 4173,
    strictPort: false,
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
});
`;
        await fs.writeFile(path.join(harnessDir, 'vite.config.ts'), viteConfig);
        // Create index.html
        const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>UI Forge Preview</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #09090b;
      color: #fafafa;
    }
    #root {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .loading {
      color: #71717a;
    }
    .error {
      color: #ef4444;
      padding: 16px;
      background: rgba(239, 68, 68, 0.1);
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="loading">Waiting for component selection...</div>
  </div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
`;
        await fs.writeFile(path.join(harnessDir, 'index.html'), indexHtml);
        // Create src directory
        await fs.mkdir(path.join(harnessDir, 'src'), { recursive: true });
        // Create main.tsx
        const mainTsx = `
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Playground } from './Playground';

// Import theme CSS from repo if available
try {
  // @ts-ignore
  import('@repo/styles/globals.css');
} catch (e) {
  console.log('No global styles found');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Playground />
  </React.StrictMode>
);
`;
        await fs.writeFile(path.join(harnessDir, 'src', 'main.tsx'), mainTsx);
        // Create Playground.tsx
        const playgroundTsx = `
import React, { useState, useEffect } from 'react';

interface ComponentMessage {
  type: 'RENDER_COMPONENT';
  componentPath: string;
  componentName: string;
  props?: Record<string, any>;
}

export function Playground() {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [props, setProps] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [componentName, setComponentName] = useState<string>('');

  useEffect(() => {
    const handleMessage = async (event: MessageEvent<ComponentMessage>) => {
      if (event.data.type !== 'RENDER_COMPONENT') return;

      const { componentPath, componentName: name, props: newProps } = event.data;
      setComponentName(name);
      setProps(newProps || {});
      setError(null);

      try {
        // Dynamic import of component
        const module = await import(/* @vite-ignore */ componentPath);
        const Comp = module[name] || module.default;
        
        if (!Comp) {
          throw new Error(\`Component \${name} not found in \${componentPath}\`);
        }
        
        setComponent(() => Comp);
      } catch (err) {
        console.error('Failed to load component:', err);
        setError((err as Error).message);
        setComponent(null);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Notify parent that playground is ready
    window.parent.postMessage({ type: 'PLAYGROUND_READY' }, '*');

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (error) {
    return (
      <div className="error">
        <strong>Error loading component:</strong>
        <pre>{error}</pre>
      </div>
    );
  }

  if (!Component) {
    return <div className="loading">Select a component to preview...</div>;
  }

  // Render with error boundary
  try {
    return <Component {...props} />;
  } catch (err) {
    return (
      <div className="error">
        <strong>Render error:</strong>
        <pre>{(err as Error).message}</pre>
      </div>
    );
  }
}
`;
        await fs.writeFile(path.join(harnessDir, 'src', 'Playground.tsx'), playgroundTsx);
        // Create tsconfig.json
        const tsconfig = {
            compilerOptions: {
                target: 'ES2020',
                useDefineForClassFields: true,
                lib: ['ES2020', 'DOM', 'DOM.Iterable'],
                module: 'ESNext',
                skipLibCheck: true,
                moduleResolution: 'bundler',
                allowImportingTsExtensions: true,
                resolveJsonModule: true,
                isolatedModules: true,
                noEmit: true,
                jsx: 'react-jsx',
                strict: true,
                noUnusedLocals: true,
                noUnusedParameters: true,
                noFallthroughCasesInSwitch: true,
                paths: {
                    '@repo/*': ['../../src/*'],
                    '@/*': ['../../src/*'],
                },
            },
            include: ['src'],
        };
        await fs.writeFile(path.join(harnessDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
        // Create .gitignore
        await fs.writeFile(path.join(harnessDir, '.gitignore'), 'node_modules\ndist\n.vite\n');
        console.log('[PreviewService] Harness setup complete');
        this.emit('log', 'Harness setup complete');
        return harnessDir;
    }
    /**
     * Start the Vite dev server
     */
    async startDevServer(harnessPath) {
        const targetPath = harnessPath || this.harnessPath;
        if (!targetPath) {
            throw new Error('Harness path not set. Call setupHarness first.');
        }
        // Stop existing server if running
        if (this.devServerProcess) {
            await this.stopDevServer();
        }
        // Install harness dependencies first
        console.log('[PreviewService] Installing harness dependencies...');
        this.emit('log', 'Installing harness dependencies...');
        await new Promise((resolve, reject) => {
            const proc = spawn('npm', ['install'], {
                cwd: targetPath,
                shell: true,
                stdio: 'pipe',
            });
            proc.on('close', (code) => {
                if (code === 0)
                    resolve();
                else
                    reject(new Error(`npm install failed with code ${code}`));
            });
            proc.on('error', reject);
        });
        // Start Vite dev server
        return new Promise((resolve, reject) => {
            console.log('[PreviewService] Starting Vite dev server...');
            this.emit('log', 'Starting Vite dev server...');
            this.devServerProcess = spawn('npm', ['run', 'dev'], {
                cwd: targetPath,
                shell: true,
                stdio: 'pipe',
            });
            let resolved = false;
            this.devServerProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                this.logs.push(output);
                this.emit('log', output);
                // Parse Vite output to find the URL
                const urlMatch = output.match(/Local:\s+(http:\/\/[^\s]+)/);
                if (urlMatch && !resolved) {
                    resolved = true;
                    const url = urlMatch[1];
                    const portMatch = url.match(/:(\d+)/);
                    const port = portMatch ? parseInt(portMatch[1]) : 4173;
                    this.serverInfo = {
                        url,
                        port,
                        pid: this.devServerProcess.pid,
                    };
                    console.log(`[PreviewService] Dev server running at ${url}`);
                    this.emit('log', `Dev server running at ${url}`);
                    this.emit('ready', this.serverInfo);
                    resolve(this.serverInfo);
                }
            });
            this.devServerProcess.stderr?.on('data', (data) => {
                const output = data.toString();
                this.logs.push(output);
                this.emit('log', output);
            });
            this.devServerProcess.on('error', (error) => {
                this.emit('error', error);
                if (!resolved)
                    reject(error);
            });
            this.devServerProcess.on('close', (code) => {
                console.log(`[PreviewService] Dev server exited with code ${code}`);
                this.serverInfo = null;
                this.devServerProcess = null;
            });
            // Timeout after 60 seconds
            setTimeout(() => {
                if (!resolved) {
                    reject(new Error('Dev server startup timed out'));
                }
            }, 60000);
        });
    }
    /**
     * Stop the dev server
     */
    async stopDevServer() {
        if (!this.devServerProcess) {
            return;
        }
        console.log('[PreviewService] Stopping dev server...');
        this.emit('log', 'Stopping dev server...');
        return new Promise((resolve) => {
            this.devServerProcess.on('close', () => {
                this.devServerProcess = null;
                this.serverInfo = null;
                resolve();
            });
            // Kill the process
            this.devServerProcess.kill('SIGTERM');
            // Force kill after 5 seconds
            setTimeout(() => {
                if (this.devServerProcess) {
                    this.devServerProcess.kill('SIGKILL');
                }
                resolve();
            }, 5000);
        });
    }
    /**
     * Get current server info
     */
    getServerInfo() {
        return this.serverInfo;
    }
    /**
     * Get logs
     */
    getLogs() {
        return this.logs;
    }
    /**
     * Check if server is running
     */
    isRunning() {
        return this.devServerProcess !== null;
    }
}
// Singleton instance
export const previewService = new PreviewService();
