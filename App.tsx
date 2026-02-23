import React, { useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { ReactSandbox } from './components/ReactSandbox';
import { PropertiesPanel } from './components/PropertiesPanel';
import { SyncModal } from './components/SyncModal';
import { ConnectModal } from './components/ConnectModal';
import { TitleBar } from './components/TitleBar';
// StateSelector is now integrated into the PropertiesPanel (Design tab)
import { ComponentNode, Token } from './types';
import { CheckCircle2, AlertCircle, GitPullRequestArrow } from 'lucide-react';
import { useAppState } from './hooks/useAppState';
import { useChangeHistory } from './hooks/useChangeHistory';
import { AiFloatingChat } from './components/AiFloatingChat';
import { useAuth } from './hooks/useAuth';
import { AuthModal } from './components/AuthModal';

// Import electron types
import './types/electron.d.ts';

export default function App() {
  const {
    state,
    dispatch,
    selectedItem,
    recentRepos,
    handleFinalizeConnection,
    handleRefreshRepo,
    silentRefreshRepo,
    handlePullRepo,
    handleConfirmSync,
    handleUpdateComponent,
    handleUpdateToken,
    handleSwitchRepo,
    handleRemoveRecentRepo,
    checkGitStatus,
    handleSwitchBranch,
    handleCreateBranch,
    handleDiscardAll,
  } = useAppState();

  const { user, isLoading: isAuthLoading } = useAuth();
  // We use skeleton mode if checking auth state or if logged out
  const isSkeletonMode = isAuthLoading || !user;

  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiSessionKey, setAiSessionKey] = useState(0);

  // ─── Change History (undo/redo) ──────────────────────────────
  const { pushChange } = useChangeHistory({
    onUndoRedo: silentRefreshRepo,
    showToast: (msg, type) => dispatch({ type: 'SET_TOAST', payload: { message: msg, type } }),
  });

  // ─── AI Action Handlers ─────────────────────────────────────
  const handleAiCSSChange = useCallback((prop: string, value: string) => {
    const comp = state.selectionType === 'component'
      ? state.repo.components.find(c => c.id === state.selectedId)
      : null;
    if (!comp) return;
    const updated = {
      ...comp,
      styleOverrides: { ...(comp.styleOverrides || {}), [prop]: value },
    };
    handleUpdateComponent(updated);
  }, [state.selectionType, state.repo.components, state.selectedId, handleUpdateComponent]);

  const handleAiPropChange = useCallback((propName: string, value: any) => {
    const comp = state.selectionType === 'component'
      ? state.repo.components.find(c => c.id === state.selectedId)
      : null;
    if (!comp) return;
    // Parse value types
    let parsedValue: any = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(Number(value)) && value !== '') parsedValue = Number(value);
    const updated = {
      ...comp,
      props: { ...comp.props, [propName]: parsedValue },
    };
    handleUpdateComponent(updated);
  }, [state.selectionType, state.repo.components, state.selectedId, handleUpdateComponent]);

  const handleAiVariantChange = useCallback((variantCssClass: string) => {
    if (!state.selectedId || state.selectionType !== 'component') return;
    dispatch({ type: 'SELECT_VARIANT', payload: { componentId: state.selectedId, variantCssClass } });
  }, [state.selectedId, state.selectionType, dispatch]);

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-white overflow-hidden">
      {/* Title Bar for Electron */}
      <TitleBar />

      {/* Main App Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* 1. Sidebar */}
        <Sidebar
          isSkeletonMode={isSkeletonMode}
          repo={state.repo}
          selectedId={state.selectedId}
          selectedVariant={(selectedItem as ComponentNode)?.selectedVariant}
          onSelect={(id, type) => dispatch({ type: 'SELECT_ITEM', payload: { id, selectionType: type } })}
          onSelectVariant={(componentId, variantCssClass) =>
            dispatch({ type: 'SELECT_VARIANT', payload: { componentId, variantCssClass } })
          }
          onSync={() => dispatch({ type: 'SHOW_SYNC_MODAL', payload: true })}
          isSyncing={state.isSyncing}
          isConnected={state.isConnected}
          onConnect={() => dispatch({ type: 'SHOW_CONNECT_MODAL', payload: true })}
          onRefresh={handleRefreshRepo}
          onPull={handlePullRepo}
          recentRepos={recentRepos}
          onSwitchRepo={handleSwitchRepo}
          onRemoveRecentRepo={handleRemoveRecentRepo}
          activeRepoPath={state.repoPath}
          gitStatus={state.gitStatus}
          onSwitchBranch={handleSwitchBranch}
          onCreateBranch={handleCreateBranch}
          onDiscardAll={handleDiscardAll}
          onCheckGitStatus={checkGitStatus}
        />

        {/* 2. Main Canvas Area */}
        <main className="flex-1 flex flex-col relative">
          {/* ReactSandbox Preview */}
          <ReactSandbox
            component={state.selectionType === 'component' ? (selectedItem as ComponentNode) : null}
            allComponents={state.repo.components}
            token={state.selectionType === 'token' ? (selectedItem as Token) : null}
            zoom={1}
            themeCSS={state.repo.themeCSS}
            viewMode={state.viewMode}
            utilities={state.repo.utilities}
            previewConfig={state.repo.preview}
            onComputedStyles={(styles) => dispatch({ type: 'SET_COMPUTED_STYLES', payload: styles })}
            repoAssets={state.repo.repoAssets}
            forceState={state.forceState}
            selectedSubElement={state.selectedSubElement}
            inspectorMode={state.inspectorMode}
            onInspectorToggle={() => dispatch({ type: 'TOGGLE_INSPECTOR' })}
            aliases={state.repo.aliases}
            availableSubElements={state.availableSubElements}
            interactiveSelectorEnabled={state.interactiveSelectorEnabled}
            onInteractiveSelect={useCallback((sub) => dispatch({ type: 'SET_SELECTED_SUB_ELEMENT', payload: sub }), [])}
            onInteractiveSelectorToggle={() => dispatch({ type: 'TOGGLE_INTERACTIVE_SELECTOR' })}
            isSkeletonMode={isSkeletonMode}
          />

          {/* Toast Notification */}
          {!isSkeletonMode && state.toast && (
            <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg shadow-xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300 z-50 ${state.toast.type === 'success' ? 'bg-zinc-900 border-green-900/50 text-green-400' : 'bg-zinc-900 border-red-900/50 text-red-400'
              }`}>
              {state.toast.icon ? state.toast.icon : (state.toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />)}
              <span className="text-sm font-medium">{state.toast.message}</span>
            </div>
          )}

          {/* "Select a Repository" Overlay */}
          {!isSkeletonMode && !state.repoPath && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm z-10 transition-colors">
              <div className="text-center p-8 max-w-md">
                <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-900/20">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-white mb-2 tracking-tight">Select a Repository</h3>
                <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                  Open an existing React component library or create a new one to start generating UI.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => dispatch({ type: 'SHOW_CONNECT_MODAL', payload: true })}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-md font-medium text-sm hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2 group"
                  >
                    <span>Open Repository</span>
                    <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty Selection State */}
          {!isSkeletonMode && state.repoPath && !selectedItem && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm z-10 transition-colors">
              <div className="text-center p-8 max-w-md">
                <div className="w-16 h-16 bg-zinc-800 text-zinc-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-zinc-900/20">
                  <GitPullRequestArrow className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-medium text-white mb-2 tracking-tight">No Item Selected</h3>
                <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                  Select a component or token from the sidebar to view and edit its properties.
                </p>
              </div>
            </div>
          )}

          {/* AI Assistant FAB — bottom-left of preview area */}
          {!isSkeletonMode && !aiChatOpen && (
            <button
              onClick={() => setAiChatOpen(true)}
              className="absolute bottom-4 left-4 z-40 w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg flex items-center justify-center transition-all hover:scale-110"
              title="Open AI Assistant"
            >
              <svg width="24" height="24" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 84.5C18.7909 84.5 17 82.7091 17 80.5L17 73.415C17.0001 62.4767 25.3972 53.5017 36.0967 52.5801C37.0592 42.9884 45.1547 35.5 55 35.5L60.0586 35.5C60.8234 25.7078 69.0114 18 79 18L81 18C82.1046 18 83 18.8954 83 20C83 20.0848 82.9927 20.168 82.9824 20.25C82.9927 20.332 83 20.4152 83 20.5L83 62.5C83 74.6503 73.1503 84.5 61 84.5L21 84.5ZM61 80.5C70.9411 80.5 79 72.4411 79 62.5L79 22C70.7157 22 64 28.7157 64 37C64 37.0848 63.9927 37.168 63.9824 37.25C63.9927 37.332 64 37.4152 64 37.5C64 38.6046 63.1046 39.5 62 39.5L55 39.5C46.7157 39.5 40 46.2157 40 54.5C40 55.6046 39.1046 56.5 38 56.5C37.986 56.5 37.972 56.4983 37.958 56.498C37.9437 56.4983 37.9294 56.5 37.915 56.5C28.5732 56.5001 21.0001 64.0732 21 73.415L21 80.5L61 80.5Z" fill="currentColor" />
                <circle cx="48.5" cy="54.5" r="3.5" fill="currentColor" />
                <circle cx="70.5" cy="54.5" r="3.5" fill="currentColor" />
                <path d="M38 65H71" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                <path d="M34.7316 5.27562C35.8544 2.24146 40.1457 2.24146 41.2684 5.27562L44.3462 13.5947C44.6992 14.5485 45.4516 15.3008 46.4053 15.6538L54.7244 18.7316C57.7585 19.8544 57.7585 24.1457 54.7244 25.2685L46.4053 28.3463C45.4516 28.6993 44.6992 29.4516 44.3462 30.4054L41.2684 38.7245L41.1538 39.0001C39.9213 41.6666 36.0787 41.6666 34.8462 39.0001L34.7316 38.7245L31.6538 30.4054C31.3228 29.5111 30.6404 28.7947 29.7705 28.4178L29.5947 28.3463L21.2756 25.2685C18.2415 24.1457 18.2415 19.8544 21.2756 18.7316L29.5947 15.6538C30.4889 15.3228 31.2054 14.6405 31.5823 13.7706L31.6538 13.5947L34.7316 5.27562ZM36.0113 15.2068C35.1876 17.4327 33.4326 19.1877 31.2068 20.0113L25.8305 22L31.2068 23.9888C33.2935 24.7609 34.966 26.3517 35.8456 28.3815L36.0113 28.7933L38 34.1684L39.9887 28.7933L40.1544 28.3815C41.034 26.3517 42.7065 24.7609 44.7932 23.9888L50.1683 22L44.7932 20.0113C42.5674 19.1877 40.8124 17.4327 39.9887 15.2068L38 9.83053L36.0113 15.2068Z" fill="currentColor" />
                <path d="M14.0419 33.9589C15.0084 31.347 18.7023 31.347 19.6688 33.9589L21.3729 38.5653C21.6768 39.3863 22.3244 40.0339 23.1454 40.3378L27.7518 42.0419C30.3637 43.0084 30.3637 46.7023 27.7518 47.6688L23.1454 49.3729C22.3244 49.6768 21.6768 50.3244 21.3729 51.1454L19.6688 55.7518L19.5702 55.9891C18.5092 58.2845 15.2015 58.2845 14.1405 55.9891L14.0419 55.7518L12.3378 51.1454C12.0529 50.3756 11.4655 49.7589 10.7167 49.4345L10.5653 49.3729L5.95886 47.6688C3.34705 46.7023 3.34704 43.0084 5.95886 42.0419L10.5653 40.3378C11.3351 40.0529 11.9518 39.4655 12.2762 38.7167L12.3378 38.5653L14.0419 33.9589ZM16.0887 39.953C15.3797 41.869 13.869 43.3797 11.953 44.0887L9.88074 44.8553L11.953 45.622C13.7492 46.2866 15.189 47.6559 15.9462 49.4032L16.0887 49.7577L16.8553 51.829L17.622 49.7577L17.7645 49.4032C18.5217 47.6559 19.9615 46.2866 21.7577 45.622L23.829 44.8553L21.7577 44.0887C19.8417 43.3797 18.3309 41.869 17.622 39.953L16.8553 37.8807L16.0887 39.953Z" fill="currentColor" />
              </svg>
            </button>
          )}
        </main>

        {/* 3. Properties Panel */}
        <PropertiesPanel
          isSkeletonMode={isSkeletonMode}
          selection={selectedItem}
          onUpdateComponent={handleUpdateComponent}
          onUpdateToken={handleUpdateToken}
          repo={state.repo}
          computedStyles={state.computedStyles}
          forceState={state.forceState}
          onForceStateChange={(s) => dispatch({ type: 'SET_FORCE_STATE', payload: s })}
          tokens={state.repo.tokens}
          selectedSubElement={state.selectedSubElement}
          onSelectedSubElementChange={useCallback((sub) => dispatch({ type: 'SET_SELECTED_SUB_ELEMENT', payload: sub }), [])}
          onAvailableSubElementsChange={useCallback((subs) => dispatch({ type: 'SET_AVAILABLE_SUB_ELEMENTS', payload: subs }), [])}
          onPushChange={pushChange}
        />

        {/* 4. Sync Modal Overlay */}
        <SyncModal
          isOpen={state.showSyncModal}
          onClose={() => dispatch({ type: 'SHOW_SYNC_MODAL', payload: false })}
          onConfirm={handleConfirmSync}
          currentBranch={state.repo.branch}
          repoPath={state.repoPath}
        />

        {/* 5. Connect Modal Overlay */}
        <ConnectModal
          isOpen={state.showConnectModal}
          onClose={() => dispatch({ type: 'SHOW_CONNECT_MODAL', payload: false })}
          onConnect={handleFinalizeConnection}
        />

        {/* AI Floating Chat — always mounted to preserve state on minimize */}
        <AiFloatingChat
          key={aiSessionKey}
          component={state.selectionType === 'component' ? (selectedItem as any) : null}
          repo={state.repo}
          visible={aiChatOpen}
          onMinimize={() => setAiChatOpen(false)}
          onClose={() => { setAiChatOpen(false); setAiSessionKey(k => k + 1); }}
          onCSSChange={handleAiCSSChange}
          onPropChange={handleAiPropChange}
          onVariantChange={handleAiVariantChange}
        />
      </div>

      {/* 6. Auth Modal (Shown when skeleton mode is active) */}
      {isSkeletonMode && <AuthModal />}
    </div>
  );
}
