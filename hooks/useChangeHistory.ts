/**
 * useChangeHistory — React hook for the Change History engine.
 * 
 * Provides undo/redo, pushChange, and keyboard shortcut (Cmd+Z / Shift+Cmd+Z).
 * Wraps the singleton ChangeHistory instance for React reactivity.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { changeHistory, ChangeEntry, ChangeType, buildChangeLabel } from '../lib/changeHistory';

// ─── Hook Return Type ────────────────────────────────────────

export interface UseChangeHistoryReturn {
    /** Record a new change */
    pushChange: (params: PushChangeParams) => ChangeEntry;
    /** Undo the last change — returns the reversed entry, or null */
    undo: () => Promise<ChangeEntry | null>;
    /** Redo the last undone change — returns the re-applied entry, or null */
    redo: () => Promise<ChangeEntry | null>;
    /** Whether undo is available */
    canUndo: boolean;
    /** Whether redo is available */
    canRedo: boolean;
    /** Label for the next undo action */
    undoLabel: string | null;
    /** Label for the next redo action */
    redoLabel: string | null;
    /** Total number of changes in this session */
    changeCount: number;
    /** Clear all history (on repo switch) */
    clearHistory: () => void;
    /** Store file snapshot (on repo load) */
    storeSnapshot: (filePath: string, content: string) => void;
}

export interface PushChangeParams {
    type: ChangeType;
    componentId?: string;
    componentName?: string;
    filePath: string;
    selector?: string;
    property: string;
    previousValue: string;
    newValue: string;
}

// ─── Disk Write Helpers ──────────────────────────────────────

async function applyChangeToFile(entry: ChangeEntry, value: string): Promise<boolean> {
    if (!window.electronAPI) return false;

    try {
        switch (entry.type) {
            case 'css': {
                if (!entry.target.selector) return false;
                const cssProp = entry.target.property.replace(/([A-Z])/g, '-$1').toLowerCase();
                const result = await window.electronAPI.code.writeCSS({
                    cssFilePath: entry.target.filePath,
                    selector: entry.target.selector,
                    changes: { [cssProp]: value },
                });
                return result.success;
            }
            case 'prop': {
                const result = await window.electronAPI.code.writeProp({
                    forgecorePath: entry.target.filePath,
                    componentName: entry.componentName || '',
                    propName: entry.target.property,
                    value,
                });
                return result.success;
            }
            case 'token': {
                const result = await window.electronAPI.code.writeToken({
                    themeFilePath: entry.target.filePath,
                    tokenName: entry.target.property,
                    newValue: value,
                });
                return result.success;
            }
            default:
                return false;
        }
    } catch (err) {
        console.error('[ChangeHistory] Failed to apply change to file:', err);
        return false;
    }
}

// ─── Hook ────────────────────────────────────────────────────

export interface UseChangeHistoryOptions {
    /** Called after undo/redo succeeds — should trigger a repo re-parse to refresh preview */
    onUndoRedo?: (entry: ChangeEntry, action: 'undo' | 'redo') => void;
    /** Toast feedback */
    showToast?: (message: string, type: 'success' | 'error') => void;
}

export function useChangeHistory(options?: UseChangeHistoryOptions): UseChangeHistoryReturn {
    // Keep options in ref to avoid recreating callbacks when parent re-renders
    const optionsRef = useRef(options);
    optionsRef.current = options;
    // Cache snapshot to avoid infinite re-render loop.
    // useSyncExternalStore requires getSnapshot to return the SAME reference
    // if the underlying data hasn't changed.
    const cachedSnapshot = useRef({
        canUndo: changeHistory.canUndo,
        canRedo: changeHistory.canRedo,
        undoLabel: changeHistory.undoLabel,
        redoLabel: changeHistory.redoLabel,
        changeCount: changeHistory.changeCount,
    });

    const snapshot = useSyncExternalStore(
        (cb) => changeHistory.subscribe(cb),
        () => {
            const next = {
                canUndo: changeHistory.canUndo,
                canRedo: changeHistory.canRedo,
                undoLabel: changeHistory.undoLabel,
                redoLabel: changeHistory.redoLabel,
                changeCount: changeHistory.changeCount,
            };
            const prev = cachedSnapshot.current;
            // Only return a new object if something actually changed
            if (
                prev.canUndo === next.canUndo &&
                prev.canRedo === next.canRedo &&
                prev.undoLabel === next.undoLabel &&
                prev.redoLabel === next.redoLabel &&
                prev.changeCount === next.changeCount
            ) {
                return prev;
            }
            cachedSnapshot.current = next;
            return next;
        },
    );

    // ─── Push ────────────────────────────────────────────────

    const pushChange = useCallback((params: PushChangeParams): ChangeEntry => {
        return changeHistory.push({
            type: params.type,
            componentId: params.componentId,
            componentName: params.componentName,
            target: {
                filePath: params.filePath,
                selector: params.selector,
                property: params.property,
            },
            previousValue: params.previousValue,
            newValue: params.newValue,
            label: buildChangeLabel(params.type, params.property, params.newValue, params.componentName),
        });
    }, []);

    // ─── Undo ────────────────────────────────────────────────

    const undo = useCallback(async (): Promise<ChangeEntry | null> => {
        const entry = changeHistory.undo();
        if (!entry) return null;

        // Revert the file on disk to the previous value
        const success = await applyChangeToFile(entry, entry.previousValue);
        if (!success) {
            console.warn('[ChangeHistory] Undo disk write failed for:', entry.label);
            optionsRef.current?.showToast?.(`Undo failed: ${entry.label}`, 'error');
        } else {
            optionsRef.current?.showToast?.(`Undo: ${entry.label}`, 'success');
            optionsRef.current?.onUndoRedo?.(entry, 'undo');
        }

        return entry;
    }, []);

    // ─── Redo ────────────────────────────────────────────────

    const redo = useCallback(async (): Promise<ChangeEntry | null> => {
        const entry = changeHistory.redo();
        if (!entry) return null;

        // Re-apply the change on disk
        const success = await applyChangeToFile(entry, entry.newValue);
        if (!success) {
            console.warn('[ChangeHistory] Redo disk write failed for:', entry.label);
            optionsRef.current?.showToast?.(`Redo failed: ${entry.label}`, 'error');
        } else {
            optionsRef.current?.showToast?.(`Redo: ${entry.label}`, 'success');
            optionsRef.current?.onUndoRedo?.(entry, 'redo');
        }

        return entry;
    }, []);

    // ─── Keyboard Shortcuts ──────────────────────────────────

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const isMeta = e.metaKey || e.ctrlKey;
            if (!isMeta || e.key !== 'z') return;

            e.preventDefault();

            if (e.shiftKey) {
                redo();
            } else {
                undo();
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [undo, redo]);

    // ─── Helpers ─────────────────────────────────────────────

    const clearHistory = useCallback(() => {
        changeHistory.clear();
    }, []);

    const storeSnapshot = useCallback((filePath: string, content: string) => {
        changeHistory.setSnapshot(filePath, content);
    }, []);

    return {
        pushChange,
        undo,
        redo,
        canUndo: snapshot.canUndo,
        canRedo: snapshot.canRedo,
        undoLabel: snapshot.undoLabel,
        redoLabel: snapshot.redoLabel,
        changeCount: snapshot.changeCount,
        clearHistory,
        storeSnapshot,
    };
}
