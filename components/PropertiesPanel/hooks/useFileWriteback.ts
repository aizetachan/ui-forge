/**
 * useFileWriteback Hook
 * 
 * Manages debounced file persistence for component property changes.
 * Writes to forgecore.json (props) with 500ms debounce.
 * 
 * CSS writeback is handled directly in PropertiesPanel.handleCSSPropertyChange
 * with the correct variant-aware selector.
 */

import { useCallback, useRef } from 'react';
import type { PushChangeParams } from '../../../hooks/useChangeHistory';

export interface UseFileWritebackOptions {
    /** Whether running in Electron environment */
    isElectron: boolean;
    /** Path to forgecore.json for this component */
    forgecorePath?: string;
    /** Component name */
    componentName?: string;
    /** Component ID */
    componentId?: string;
    /** Path to the component's .module.css file */
    cssModulePath?: string;
    /** Change History: callback to push a change entry for undo/redo */
    onPushChange?: (params: PushChangeParams) => void;
}

export interface UseFileWritebackReturn {
    /** Write a prop change to forgecore.json (debounced 500ms) */
    writePropToFile: (propName: string, value: any) => void;
}

export function useFileWriteback({
    isElectron,
    forgecorePath,
    componentName,
    componentId,
    onPushChange,
}: UseFileWritebackOptions): UseFileWritebackReturn {
    const propWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Write a prop change to forgecore.json (debounced 500ms)
    const writePropToFile = useCallback((propName: string, value: any) => {
        if (!isElectron || !forgecorePath) return;
        if (propWriteTimer.current) clearTimeout(propWriteTimer.current);
        propWriteTimer.current = setTimeout(async () => {
            try {
                const result = await window.electronAPI!.code.writeProp({
                    forgecorePath: forgecorePath!,
                    componentName: componentName || '',
                    propName,
                    value,
                });
                if (!result.success) {
                    console.warn('[PropertiesPanel] Prop write failed:', result.error);
                } else if (onPushChange && result.previousValue !== undefined) {
                    onPushChange({
                        type: 'prop',
                        componentId,
                        componentName,
                        filePath: forgecorePath!,
                        property: propName,
                        previousValue: result.previousValue,
                        newValue: JSON.stringify(value),
                    });
                }
            } catch (err) {
                console.error('[PropertiesPanel] Prop write error:', err);
            }
        }, 500);
    }, [isElectron, forgecorePath, componentName, componentId, onPushChange]);

    return {
        writePropToFile,
    };
}

