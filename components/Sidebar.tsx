import React, { useState, useEffect } from 'react';
import { Settings, RefreshCw, X, FolderOpen, PanelLeftClose, PanelLeft, Search, Plus, Trash2, GitPullRequest, Beaker, Check, Package, GitBranch, Github, ArrowDownToLine, Database, Plug, ChevronRight, Layers } from 'lucide-react';
import { Repository, ComponentNode } from '../types';
import type { RecentRepo } from '../hooks/useAppState';

interface SidebarProps {
  repo: Repository;
  selectedId: string | null;
  selectedVariant?: string;
  onSelect: (id: string, type: 'component' | 'token') => void;
  onSelectVariant?: (componentId: string, variantCssClass: string) => void;
  onSync: () => void;
  isSyncing: boolean;
  isConnected: boolean;
  onConnect: () => void;
  onRefresh?: () => void;
  onPull?: () => void;
  recentRepos?: RecentRepo[];
  onSwitchRepo?: (repo: RecentRepo) => void;
  onRemoveRecentRepo?: (path: string) => void;
  activeRepoPath?: string;
  gitStatus?: { behind: number; ahead: number } | null;
  onSwitchBranch?: (branchName: string) => void;
  onCreateBranch?: (branchName: string) => void;
  onCheckGitStatus?: () => void;
  isSkeletonMode?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  repo, selectedId, selectedVariant, onSelect, onSelectVariant, onSync, isSyncing, isConnected, onConnect, onRefresh, onPull,
  recentRepos = [], onSwitchRepo, onRemoveRecentRepo, activeRepoPath,
  gitStatus, onSwitchBranch, onCreateBranch, onCheckGitStatus, isSkeletonMode
}) => {
  const [activeTab, setActiveTab] = useState<'components' | 'tokens'>('components');
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showRepoList, setShowRepoList] = useState(false);
  const [showBranchList, setShowBranchList] = useState(false);
  const [branches, setBranches] = useState<{ current: string, all: { name: string; type: 'local' | 'remote' }[] } | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);

  // Poll git status
  useEffect(() => {
    if (isConnected && onCheckGitStatus) {
      onCheckGitStatus();
      const interval = setInterval(onCheckGitStatus, 60000);
      return () => clearInterval(interval);
    }
  }, [isConnected, onCheckGitStatus]);

  const loadBranches = async () => {
    if (activeRepoPath && window.electronAPI?.git?.getBranches) {
      setBranches(null);
      try {
        const res = await window.electronAPI.git.getBranches(activeRepoPath);
        if (res.success && res.data) {
          setBranches(res.data);
        } else {
          setBranches({ current: repo?.branch || 'unknown', all: [{ name: repo?.branch || 'unknown', type: 'local' }] });
        }
      } catch (error) {
        setBranches({ current: repo?.branch || 'unknown', all: [{ name: repo?.branch || 'unknown', type: 'local' }] });
      }
    }
  };

  useEffect(() => {
    if (showBranchList) {
      loadBranches();
    }
  }, [showBranchList, activeRepoPath]);

  if (isSkeletonMode) {
    return (
      <div className="w-[300px] border-r border-zinc-800 bg-zinc-900/50 flex flex-col h-full overflow-hidden select-none pointer-events-none">

        {/* Header Skeleton */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="w-24 h-5 bg-zinc-800 rounded"></div>
          <div className="w-8 h-8 bg-zinc-800 rounded-lg"></div>
        </div>

        {/* Content Skeleton */}
        <div className="p-4 space-y-4">
          <div className="w-full h-8 bg-zinc-800 rounded mb-6"></div>

          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-4 h-4 bg-zinc-800 rounded"></div>
                <div className={`h-4 bg-zinc-800 rounded ${i % 2 === 0 ? 'w-3/4' : 'w-1/2'}`}></div>
              </div>
            ))}
          </div>
        </div>

      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedComponents(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter components based on search
  const filteredComponents = repo.components.filter(comp =>
    comp.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTokens = repo.tokens.filter(token =>
    token.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-64 border-r border-zinc-800 bg-zinc-900 flex flex-col h-full">
      {/* Header - Empty space matching Canvas toolbar height */}
      <div className="h-10 border-b border-zinc-800 shrink-0" />

      {/* Repo Connection State */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
        {!isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-zinc-400">
              <Github className="w-4 h-4" />
              <span className="text-xs font-semibold">No Repository</span>
            </div>
            <button
              onClick={onConnect}
              className="w-full text-xs py-2 px-3 rounded bg-zinc-100 text-zinc-900 hover:bg-white font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Plug className="w-3 h-3" />
              Connect Repo
            </button>
            {/* Show recent repos for quick reconnect */}
            {recentRepos.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-zinc-800/50">
                <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">Recent</span>
                {recentRepos.slice(0, 3).map(r => (
                  <button
                    key={r.path}
                    onClick={() => onSwitchRepo?.(r)}
                    className="w-full text-left text-xs px-2 py-1.5 rounded bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors truncate"
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Repository</span>
              <div className="flex items-center gap-2">
                {/* Repo Switcher Icon */}
                {recentRepos.length > 0 && (
                  <button
                    onClick={() => setShowRepoList(!showRepoList)}
                    title="Switch repository"
                    className={`p-1 rounded transition-colors ${showRepoList ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="flex items-center gap-1 text-green-500 text-[10px] font-mono">
                  <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></div>
                  Connected
                </div>
              </div>
            </div>
            <div className="text-sm font-medium truncate">{repo.name}</div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1 relative">
              <button
                onClick={() => setShowBranchList(!showBranchList)}
                className={`flex items-center gap-1.5 px-1.5 py-0.5 -ml-1.5 rounded transition-colors ${showBranchList ? 'bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-800 hover:text-zinc-300'}`}
              >
                <GitBranch className="w-3 h-3" />
                <span>{repo.branch}</span>
              </button>
              {gitStatus && (gitStatus.behind > 0 || gitStatus.ahead > 0) && (
                <div className="flex items-center gap-1 text-[10px] font-mono" title={`${gitStatus.ahead} ahead, ${gitStatus.behind} behind origin`}>
                  {gitStatus.ahead > 0 && <span className="text-blue-400">↑{gitStatus.ahead}</span>}
                  {gitStatus.behind > 0 && <span className="text-amber-400">↓{gitStatus.behind}</span>}
                </div>
              )}

              {showBranchList && (
                <div className="absolute top-full left-0 mt-1 w-48 max-h-64 flex flex-col bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-50 p-1">
                  {/* Create New Branch input */}
                  <div className="p-1 mb-1 border-b border-zinc-800">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="New branch name..."
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                        onKeyDown={async (e) => {
                          const sanitizedName = newBranchName.trim().replace(/\s+/g, '-');
                          if (e.key === 'Enter' && sanitizedName && onCreateBranch && !isCreatingBranch) {
                            setIsCreatingBranch(true);
                            await onCreateBranch(sanitizedName);
                            setIsCreatingBranch(false);
                            setNewBranchName('');
                            setShowBranchList(false);
                          }
                        }}
                        disabled={isCreatingBranch}
                        className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-1 text-[10px] text-zinc-300 focus:outline-none focus:border-blue-500 disabled:opacity-50 min-w-0"
                      />
                      <button
                        onClick={async () => {
                          const sanitizedName = newBranchName.trim().replace(/\s+/g, '-');
                          if (sanitizedName && onCreateBranch && !isCreatingBranch) {
                            setIsCreatingBranch(true);
                            await onCreateBranch(sanitizedName);
                            setIsCreatingBranch(false);
                            setNewBranchName('');
                            setShowBranchList(false);
                          }
                        }}
                        disabled={!newBranchName.trim() || isCreatingBranch}
                        className="shrink-0 p-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Create Branch & Push"
                      >
                        {isCreatingBranch ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-y-auto custom-scrollbar flex-1">
                    {!branches ? (
                      <div className="p-4 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Fetching branches...</span>
                      </div>
                    ) : (
                      branches.all.map(b => {
                        const isCurrent = b.name === (repo?.branch || branches.current);
                        // Avoid listing "HEAD" pointers
                        if (b.name.includes('HEAD')) return null;

                        return (
                          <button
                            key={b.name}
                            onClick={() => {
                              if (!isCurrent) onSwitchBranch?.(b.name);
                              setShowBranchList(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 text-xs rounded-sm flex items-center gap-2 group ${isCurrent ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
                          >
                            <span className="w-3.5 flex items-center justify-center shrink-0">
                              {isCurrent && <Check className="w-3.5 h-3.5" />}
                            </span>
                            <span className="truncate flex-1">{b.name}</span>
                            {b.type === 'remote' ? (
                              <span className="shrink-0 text-[10px] text-zinc-500 font-medium group-hover:text-zinc-400 transition-colors" title="On GitHub">G</span>
                            ) : (
                              <span className="shrink-0 text-[10px] text-zinc-600 font-medium group-hover:text-zinc-500 transition-colors" title="Local only">L</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onSync}
              disabled={isSyncing}
              className={`mt-3 w-full text-xs py-1.5 px-3 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSyncing ? 'Pushing...' : <><GitPullRequest className="w-3 h-3" /> Push Changes</>}
            </button>

            {/* Pull & Refresh buttons */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={onRefresh}
                title="Re-parse local files"
                className="flex-1 text-xs py-1.5 px-2 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1.5 text-zinc-400 hover:text-zinc-200"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
              <button
                onClick={onPull}
                title="Pull from GitHub & refresh"
                className="flex-1 text-xs py-1.5 px-2 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1.5 text-zinc-400 hover:text-zinc-200"
              >
                <ArrowDownToLine className="w-3 h-3" /> Pull
              </button>
            </div>
          </>
        )}
      </div>

      {/* Navigation Tabs — always visible */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => { setShowRepoList(false); setActiveTab('components'); }}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 ${!showRepoList && activeTab === 'components' ? 'text-white border-b-2 border-blue-500 bg-zinc-800/30' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Package className="w-3.5 h-3.5" /> Components
        </button>
        <button
          onClick={() => { setShowRepoList(false); setActiveTab('tokens'); }}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 ${!showRepoList && activeTab === 'tokens' ? 'text-white border-b-2 border-blue-500 bg-zinc-800/30' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Database className="w-3.5 h-3.5" /> Tokens
        </button>
      </div>

      {/* Content area — repo list or component/token list */}
      {showRepoList ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {recentRepos.map(r => {
              const isActive = r.path === activeRepoPath;
              return (
                <div
                  key={r.path}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-md transition-colors ${isActive
                    ? 'bg-blue-600/10 border border-blue-600/20'
                    : 'hover:bg-zinc-800 border border-transparent'
                    }`}
                >
                  <button
                    onClick={() => {
                      if (!isActive) {
                        onSwitchRepo?.(r);
                        setShowRepoList(false);
                      }
                    }}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className={`text-sm font-medium truncate ${isActive ? 'text-blue-400' : 'text-zinc-300'}`}>
                      {isActive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-2 align-middle" />}
                      {r.name}
                    </div>
                    <div className="text-[10px] text-zinc-600 truncate mt-0.5">{r.path}</div>
                  </button>
                  {!isActive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveRecentRepo?.(r.path); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700 transition-all"
                      title="Remove from history"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Connect New Repo Button */}
            <button
              onClick={() => { setShowRepoList(false); onConnect(); }}
              className="w-full mt-2 text-xs py-2.5 px-3 rounded-md border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Connect New Repo
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {/* Search */}
          <div className="px-2 mb-3 mt-2">
            <div className="relative">
              <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder={activeTab === 'components' ? "Filter components..." : "Filter tokens..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded py-1 pl-7 pr-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="space-y-0.5">
            {activeTab === 'components' ? (
              filteredComponents.map((comp) => {
                const styleVariants = comp.variants?.filter(v => v.type === 'variant') || [];
                const hasVariants = styleVariants.length > 0;
                const isExpanded = expandedComponents.has(comp.id);
                const isSelected = selectedId === comp.id;

                return (
                  <div key={comp.id}>
                    <div className="flex items-center">
                      {hasVariants ? (
                        <button
                          onClick={() => toggleExpand(comp.id)}
                          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          <ChevronRight
                            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </button>
                      ) : (
                        <div className="w-5" />
                      )}

                      <button
                        onClick={() => onSelect(comp.id, 'component')}
                        className={`flex-1 text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${isSelected
                          ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20'
                          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-transparent'
                          }`}
                      >
                        <Package className="w-4 h-4 opacity-70" />
                        <span className="truncate">{comp.name}</span>
                        {comp.componentType && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 font-mono uppercase tracking-wider whitespace-nowrap">
                            {comp.componentType}
                          </span>
                        )}
                        {hasVariants && (
                          <span className="ml-auto text-[10px] text-zinc-600 font-mono">
                            {styleVariants.length}
                          </span>
                        )}
                      </button>
                    </div>

                    {hasVariants && isExpanded && (
                      <div className="ml-5 pl-2 border-l border-zinc-800 space-y-0.5 mt-0.5 mb-1">
                        {styleVariants.map((variant, idx) => {
                          const isVariantSelected = selectedId === comp.id && selectedVariant === variant.cssClass;
                          return (
                            <button
                              key={`${comp.id}-${variant.name}-${idx}`}
                              onClick={() => {
                                onSelect(comp.id, 'component');
                                onSelectVariant?.(comp.id, variant.cssClass);
                              }}
                              className={`w-full text-left px-2 py-1 rounded text-xs flex items-center gap-2 transition-colors ${isVariantSelected
                                ? 'bg-blue-600/20 text-blue-400'
                                : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                                }`}
                            >
                              <Layers className="w-3 h-3 opacity-50" />
                              <span className="truncate capitalize">{variant.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              filteredTokens.map((token) => (
                <button
                  key={token.id}
                  onClick={() => onSelect(token.id, 'token')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between transition-colors ${selectedId === token.id
                    ? 'bg-purple-600/10 text-purple-400 border border-purple-600/20'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-transparent'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full border border-zinc-700"
                      style={{ backgroundColor: token.type === 'color' ? token.value : '#3f3f46' }}
                    />
                    {token.name}
                  </div>
                  <span className="text-[10px] opacity-50 font-mono">{token.type}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
