import React, { useState, useEffect } from 'react';
import { GitPullRequest, GitBranch, X, Save, AlertTriangle, Terminal, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { SyncPayload } from '../types';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: SyncPayload & { success: boolean }) => void;
  currentBranch: string;
  repoPath?: string; // Path to the cloned repository
}

export const SyncModal: React.FC<SyncModalProps> = ({ isOpen, onClose, onConfirm, currentBranch, repoPath }) => {
  const [branch, setBranch] = useState('');
  const [message, setMessage] = useState('');
  const [createPR, setCreatePR] = useState(true);
  const [isPushing, setIsPushing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'pushing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [changedFiles, setChangedFiles] = useState<{ file: string; status: string }[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  useEffect(() => {
    if (isOpen) {
      setBranch(`feat/design-update-${Date.now().toString().slice(-4)}`);
      setMessage('chore: update component styles and variants');
      setIsPushing(false);
      setLogs([]);
      setStatus('idle');
      setError(null);
      setChangedFiles([]);

      // Fetch git status to show changed files
      if (isElectron && repoPath) {
        setLoadingFiles(true);
        window.electronAPI!.git.status(repoPath).then(result => {
          if (result.success && result.data) {
            const files: { file: string; status: string }[] = [];
            const statusData = result.data as any;
            if (statusData.modified) statusData.modified.forEach((f: string) => files.push({ file: f, status: 'modified' }));
            if (statusData.created) statusData.created.forEach((f: string) => files.push({ file: f, status: 'added' }));
            if (statusData.deleted) statusData.deleted.forEach((f: string) => files.push({ file: f, status: 'deleted' }));
            if (statusData.not_added) statusData.not_added.forEach((f: string) => files.push({ file: f, status: 'untracked' }));
            setChangedFiles(files);
          }
        }).catch(console.error).finally(() => setLoadingFiles(false));
      }
    }
  }, [isOpen, isElectron, repoPath]);

  if (!isOpen) return null;

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const handlePush = async () => {
    setIsPushing(true);
    setStatus('pushing');
    setLogs([]);
    setError(null);

    if (!isElectron || !repoPath) {
      // Fallback simulation
      simulatePush();
      return;
    }

    try {
      addLog(`> git checkout -b ${branch}`);

      // Create branch
      const branchResult = await window.electronAPI!.git.createBranch(repoPath, branch);
      if (!branchResult.success) {
        throw new Error(branchResult.error || 'Failed to create branch');
      }
      addLog(`Switched to a new branch '${branch}'`);

      addLog(`> git add .`);
      addLog(`> git commit -m "${message}"`);

      // Commit and push
      const pushResult = await window.electronAPI!.git.commitAndPush(repoPath, message, branch);
      if (!pushResult.success) {
        throw new Error(pushResult.error || 'Failed to push');
      }

      if (pushResult.data?.commit) {
        addLog(`[${branch}] ${message}`);
        addLog(`1 file changed`);
      }

      addLog(`> git push origin ${branch}`);

      if (pushResult.data?.pushed) {
        addLog(`Branch '${branch}' pushed to origin`);
        addLog(`✓ Push successful!`);

        if (createPR) {
          addLog(`> Opening Pull Request in browser...`);
        }

        setStatus('success');

        setTimeout(() => {
          onConfirm({ branch, message, createPR, success: true });
        }, 1500);
      } else {
        addLog(`⚠ Commit saved locally but push failed`);
        addLog(`You may need to configure Git credentials`);
        setStatus('error');
        setError('Push failed. Please check your Git credentials.');
      }
    } catch (err: any) {
      addLog(`ERROR: ${err.message}`);
      setStatus('error');
      setError(err.message);
    }
  };

  const simulatePush = () => {
    const steps = [
      { msg: `> git checkout -b ${branch}`, delay: 300 },
      { msg: `Switched to a new branch '${branch}'`, delay: 600 },
      { msg: `> git add .`, delay: 900 },
      { msg: `> git commit -m "${message}"`, delay: 1200 },
      { msg: `[${branch}] ${message}`, delay: 1600 },
      { msg: `1 file changed`, delay: 1800 },
      { msg: `> git push origin ${branch}`, delay: 2200 },
      { msg: `Branch '${branch}' pushed to origin`, delay: 2800 },
      { msg: createPR ? `> Opening Pull Request in browser...` : ``, delay: 3200 },
      { msg: `[SIMULATION] Push successful!`, delay: 3600 },
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) {
        if (steps[i].msg) {
          addLog(steps[i].msg);
        }
        i++;
      } else {
        clearInterval(interval);
        setStatus('success');
        setTimeout(() => {
          onConfirm({ branch, message, createPR, success: true });
        }, 1000);
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <GitPullRequest className="w-4 h-4 text-blue-500" />
            Review & Sync to GitHub
            {!isElectron && (
              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                Simulated
              </span>
            )}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isPushing ? (
          // TERMINAL VIEW
          <div className="h-[280px] flex flex-col">
            <div className="flex items-center px-4 py-2 bg-zinc-800/50 border-b border-zinc-700 gap-2">
              <Terminal className="w-3 h-3 text-zinc-400" />
              <span className="text-xs text-zinc-400 font-mono">git push</span>
              {status === 'pushing' && <Loader2 className="w-3 h-3 text-blue-400 animate-spin ml-auto" />}
              {status === 'success' && <CheckCircle2 className="w-3 h-3 text-green-400 ml-auto" />}
              {status === 'error' && <AlertCircle className="w-3 h-3 text-red-400 ml-auto" />}
            </div>
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1 bg-zinc-950">
              {logs.map((log, i) => (
                <div key={i} className={`${log.startsWith('>') ? 'text-zinc-300 font-bold' :
                  log.startsWith('ERROR') ? 'text-red-400' :
                    log.startsWith('✓') ? 'text-green-400' :
                      log.startsWith('⚠') ? 'text-amber-400' :
                        log.includes('[SIMULATION]') ? 'text-amber-400' :
                          'text-zinc-500'
                  }`}>
                  {log}
                </div>
              ))}
              {status === 'pushing' && <div className="animate-pulse text-blue-400">_</div>}
            </div>
            {status === 'error' && (
              <div className="p-3 bg-red-900/20 border-t border-red-800 flex items-center gap-2 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
                <button
                  onClick={() => { setIsPushing(false); setStatus('idle'); }}
                  className="ml-auto text-xs underline"
                >
                  Back
                </button>
              </div>
            )}
          </div>
        ) : (
          // CONFIG VIEW
          <div className="p-6 space-y-4">
            <div className="p-3 bg-amber-950/30 border border-amber-900/50 rounded flex gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200/80">
                <span className="font-bold text-amber-500">Protected Branch:</span>
                {' '}Direct pushes to <code className="bg-amber-900/50 px-1 py-0.5 rounded text-amber-100">{currentBranch}</code> are restricted. A new branch will be created.
              </div>
            </div>

            {/* Changed Files Summary */}
            {isElectron && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wider">
                  Changed Files {changedFiles.length > 0 && <span className="text-blue-400">({changedFiles.length})</span>}
                </label>
                {loadingFiles ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Scanning changes...
                  </div>
                ) : changedFiles.length === 0 ? (
                  <div className="text-xs text-zinc-600 py-1">No changes detected</div>
                ) : (
                  <div className="max-h-[120px] overflow-y-auto rounded border border-zinc-800 bg-zinc-950">
                    {changedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono border-b border-zinc-800/50 last:border-0">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${f.status === 'modified' ? 'bg-blue-600/20 text-blue-400' :
                            f.status === 'added' ? 'bg-green-600/20 text-green-400' :
                              f.status === 'deleted' ? 'bg-red-600/20 text-red-400' :
                                'bg-zinc-700/30 text-zinc-400'
                          }`}>
                          {f.status === 'modified' ? 'M' : f.status === 'added' ? 'A' : f.status === 'deleted' ? 'D' : '?'}
                        </span>
                        <span className="text-zinc-300 truncate">{f.file}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                <GitBranch className="w-3 h-3" /> Target Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none placeholder-zinc-600 font-mono"
                placeholder="feat/..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Commit Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none placeholder-zinc-600 min-h-[80px] resize-none font-sans"
                placeholder="Describe your changes..."
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="createPR"
                checked={createPR}
                onChange={(e) => setCreatePR(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-950 text-blue-600 focus:ring-offset-zinc-900"
              />
              <label htmlFor="createPR" className="text-xs text-zinc-300 select-none cursor-pointer">
                Create Pull Request immediately
              </label>
            </div>
          </div>
        )}

        {!isPushing && (
          <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePush}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/20"
            >
              <Save className="w-3 h-3" />
              Push & Open PR
            </button>
          </div>
        )}
      </div>
    </div>
  );
};