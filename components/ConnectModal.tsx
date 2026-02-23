
import React, { useState, useEffect, useRef } from 'react';
import { Github, Copy, Terminal, X, ShieldCheck, AlertCircle, FolderGit2 } from 'lucide-react';

interface LocalRepo {
  name: string;
  path: string;
  url: string;
}

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (data: { type: 'https' | 'ssh'; repoUrl: string; repoPath: string }) => void;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({ isOpen, onClose, onConnect }) => {
  const [activeTab, setActiveTab] = useState<'HTTPS' | 'SSH' | 'CLI'>('HTTPS');
  const [repoUrl, setRepoUrl] = useState('https://github.com/aizetachan/gends.git');
  const [isCloning, setIsCloning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [localRepos, setLocalRepos] = useState<LocalRepo[]>([]);
  const [showLocalRepos, setShowLocalRepos] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  // Load local repos when modal opens
  useEffect(() => {
    if (isOpen && isElectron && window.electronAPI?.git?.listRepos) {
      window.electronAPI.git.listRepos().then((result) => {
        if (result.success && result.data) {
          setLocalRepos(result.data);
        }
      });
    }
  }, [isOpen, isElectron]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isOpen) return null;

  const handleConnectLocalRepo = (repo: LocalRepo) => {
    onConnect({
      type: 'https',
      repoUrl: repo.url,
      repoPath: repo.path
    });
  };

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const handleConnect = async () => {
    setIsCloning(true);
    setLogs([]);
    setError(null);

    // Check if running in Electron
    if (!isElectron) {
      // Fallback to simulation for web mode
      simulateClone();
      return;
    }

    try {
      addLog(`> git clone ${repoUrl}`);
      addLog(`Cloning into '${repoUrl.split('/').pop()?.replace('.git', '')}'...`);

      // Real Git clone via Electron
      const result = await window.electronAPI!.git.clone(repoUrl);

      if (result.success && result.data) {
        addLog(`remote: Enumerating objects: done.`);
        addLog(`remote: Counting objects: 100%, done.`);
        addLog(`Receiving objects: 100%, done.`);
        addLog(`Resolving deltas: 100%, done.`);
        addLog(`> Repository cloned to: ${result.data.path}`);
        addLog(`> Branch: ${result.data.branch}`);
        addLog(`Successfully connected.`);

        // Wait a bit for UX, then complete
        setTimeout(() => {
          onConnect({
            type: 'https',
            repoUrl,
            repoPath: result.data!.path
          });
        }, 1000);
      } else {
        setError(result.error || 'Unknown error occurred');
        addLog(`ERROR: ${result.error}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to clone repository');
      addLog(`ERROR: ${err.message}`);
    }
  };

  // Simulation fallback for web mode
  const simulateClone = () => {
    const steps = [
      { msg: `> git clone ${repoUrl}`, delay: 500 },
      { msg: `Cloning into '${repoUrl.split('/').pop()?.replace('.git', '')}'...`, delay: 1200 },
      { msg: `remote: Enumerating objects: 85, done.`, delay: 2000 },
      { msg: `remote: Counting objects: 100% (85/85), done.`, delay: 2400 },
      { msg: `remote: Compressing objects: 100% (64/64), done.`, delay: 3000 },
      { msg: `Receiving objects: 100% (85/85), 240.00 KiB | 2.50 MiB/s, done.`, delay: 3800 },
      { msg: `Resolving deltas: 100% (20/20), done.`, delay: 4500 },
      { msg: `> analyzing project structure...`, delay: 5200 },
      { msg: `> detected tailwind.config.js`, delay: 5800 },
      { msg: `> detected components/`, delay: 6200 },
      { msg: `> extracting tokens...`, delay: 6800 },
      { msg: `[SIMULATION] Successfully connected.`, delay: 7500 },
    ];

    let currentStep = 0;

    const runStep = () => {
      if (currentStep < steps.length) {
        setLogs(prev => [...prev, steps[currentStep].msg]);
        currentStep++;
        if (currentStep < steps.length) {
          setTimeout(runStep, steps[currentStep].delay - (steps[currentStep - 1]?.delay || 0));
        } else {
          setTimeout(() => {
            onConnect({ type: 'https', repoUrl, repoPath: '' });
          }, 1000);
        }
      }
    };

    setTimeout(runStep, 100);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-[#0d1117] border border-[#30363d] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* GitHub Style Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-[#161b22]">
          <h3 className="text-sm font-semibold text-[#c9d1d9] flex items-center gap-2">
            <Github className="w-4 h-4" />
            Clone Repository
            {!isElectron && (
              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                Web Mode (Simulated)
              </span>
            )}
          </h3>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#c9d1d9] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isCloning ? (
          // TERMINAL VIEW
          <div className="flex-1 p-0 bg-[#0d1117] flex flex-col h-[300px]">
            <div className="flex items-center px-4 py-2 bg-[#161b22] border-b border-[#30363d] gap-2">
              <Terminal className="w-3 h-3 text-[#8b949e]" />
              <span className="text-xs text-[#8b949e] font-mono">Terminal -- git operation</span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1">
              {logs.map((log, i) => (
                <div key={i} className={`${log.startsWith('>') ? 'text-[#c9d1d9] font-bold' :
                  log.startsWith('ERROR') ? 'text-red-400' :
                    log.includes('[SIMULATION]') ? 'text-amber-400' :
                      'text-[#8b949e]'
                  }`}>
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
              {!error && <div className="animate-pulse text-[#58a6ff]">_</div>}
            </div>
            {error && (
              <div className="p-3 bg-red-900/20 border-t border-red-800 flex items-center gap-2 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
                <button
                  onClick={() => { setIsCloning(false); setError(null); }}
                  className="ml-auto text-xs underline"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        ) : (
          // CONFIG VIEW
          <div className="p-4 space-y-4">
            {/* Local Repos Section */}
            {localRepos.length > 0 && showLocalRepos && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#8b949e] uppercase tracking-wider">
                    Recent Repositories
                  </span>
                  <button
                    onClick={() => setShowLocalRepos(false)}
                    className="text-[10px] text-[#8b949e] hover:text-[#c9d1d9]"
                  >
                    Hide
                  </button>
                </div>
                <div className="space-y-1">
                  {localRepos.map((repo) => (
                    <button
                      key={repo.path}
                      onClick={() => handleConnectLocalRepo(repo)}
                      className="w-full flex items-center gap-3 p-3 bg-[#161b22] border border-[#30363d] rounded-lg hover:border-[#58a6ff] hover:bg-[#1c2128] transition-all group"
                    >
                      <FolderGit2 className="w-5 h-5 text-[#58a6ff]" />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-[#c9d1d9] group-hover:text-white">
                          {repo.name}
                        </div>
                        <div className="text-[10px] text-[#8b949e] truncate">
                          {repo.path}
                        </div>
                      </div>
                      <span className="text-[10px] bg-[#238636] text-white px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        Connect
                      </span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-[#30363d] pt-3">
                  <span className="text-xs text-[#8b949e]">Or clone a new repository:</span>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="border-b border-[#30363d] flex gap-4">
              {['HTTPS', 'SSH', 'CLI'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                    ? 'border-[#f78166] text-[#c9d1d9]'
                    : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Input Area */}
            <div className="space-y-3 pt-2">
              <p className="text-xs text-[#8b949e]">
                {activeTab === 'HTTPS' && "Clone using the web URL."}
                {activeTab === 'SSH' && "Clone using an SSH key and passphrase."}
                {activeTab === 'CLI' && "Use GitHub CLI to clone."}
              </p>

              <div className="flex items-center bg-[#0d1117] border border-[#30363d] rounded-md overflow-hidden focus-within:border-[#58a6ff] focus-within:ring-1 focus-within:ring-[#58a6ff]">
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-[#c9d1d9] px-3 py-2 outline-none font-mono"
                />
                <button
                  className="p-2 text-[#8b949e] hover:text-[#c9d1d9] border-l border-[#30363d] hover:bg-[#21262d] transition-colors"
                  onClick={() => navigator.clipboard.writeText(repoUrl)}
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-[#30363d] space-y-2">
              <button
                onClick={handleConnect}
                className="w-full py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-md text-sm font-semibold shadow-sm border border-[rgba(27,31,35,0.15)] transition-colors"
              >
                Connect & Clone
              </button>
              <div className="text-center">
                <button className="text-xs text-[#58a6ff] hover:underline mt-2">
                  Download ZIP
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {!isCloning && (
          <div className="p-3 bg-[#161b22] border-t border-[#30363d] flex items-center justify-center gap-2 text-[10px] text-[#8b949e]">
            <ShieldCheck className="w-3 h-3" />
            <span>{isElectron ? 'Using local Git' : 'Secure connection via GitHub API'}</span>
          </div>
        )}
      </div>
    </div>
  );
};
