/**
 * useStyleOverrides Hook
 * 
 * Manages variant-scoped style overrides for components.
 * Style changes are isolated to each variant+size combination.
 * Optionally triggers file writes via onWriteCSS callback.
 */

import { useCallback, useMemo } from 'react';
import { ComponentNode } from '../../../types';

export interface UseStyleOverridesOptions {
    component: ComponentNode;
    onUpdateComponent: (updated: ComponentNode) => void;
    /** Optional callback to write CSS changes to file (debounced externally) */
    onWriteCSS?: (cssProp: string, value: string) => void;
}

export interface UseStyleOverridesReturn {
    /** Current variant+size key like "primary_md" */
    variantKey: string;
    /** Get a style override value for the current variant */
    getStyleOverride: (prop: string) => string | number | undefined;
    /** Update a style override for the current variant only.
     *  When selector is provided (sub-element), stores under composite key variantKey::selector */
    updateStyleOverride: (prop: string, value: string | number, selector?: string) => void;
    /** Get all style overrides for current variant, optionally scoped to a sub-element */
    getCurrentStyleOverrides: (selector?: string) => Record<string, string | number>;
    /** F3: Get aggregated style overrides across all modifier selectors */
    getModifierStyleOverrides: () => Record<string, string | number>;
}

/**
 * Hook for managing variant-scoped style overrides
 * 
 * @example
 * const { getStyleOverride, updateStyleOverride } = useStyleOverrides({
 *   component,
 *   onUpdateComponent,
 *   onWriteCSS: writeCSSToFile, // optional: writes to .module.css
 * });
 */
export function useStyleOverrides({
    component,
    onUpdateComponent,
    onWriteCSS,
}: UseStyleOverridesOptions): UseStyleOverridesReturn {

    // Generate key for current variant+size combination
    const variantKey = useMemo(() => {
        const variant = component.selectedVariant || 'default';
        const size = component.selectedSize || 'default';
        return `${variant}_${size}`;
    }, [component.selectedVariant, component.selectedSize]);

    // Get a style override value for the current variant
    const getStyleOverride = useCallback((prop: string): string | number | undefined => {
        return component.styleOverridesPerVariant?.[variantKey]?.[prop];
    }, [component.styleOverridesPerVariant, variantKey]);

    // Update a style override for the current variant only
    // When selector is provided (sub-element editing), store under composite key
    const updateStyleOverride = useCallback((prop: string, value: string | number, selector?: string) => {
        const currentOverrides = component.styleOverridesPerVariant || {};

        // Determine the storage key — plain variantKey for main, composite for sub-elements
        const isSubElement = selector && selector !== '__main__';
        const storageKey = isSubElement ? `${variantKey}::${selector}` : variantKey;

        const slotOverrides = currentOverrides[storageKey] || {};

        onUpdateComponent({
            ...component,
            styleOverridesPerVariant: {
                ...currentOverrides,
                [storageKey]: {
                    ...slotOverrides,
                    [prop]: value
                }
            }
        });

        // Also write CSS change to file if callback provided
        if (onWriteCSS) {
            onWriteCSS(prop, String(value));
        }
    }, [component, variantKey, onUpdateComponent, onWriteCSS]);

    // Get all style overrides for current variant, optionally scoped to a sub-element
    const getCurrentStyleOverrides = useCallback((selector?: string): Record<string, string | number> => {
        const isSubElement = selector && selector !== '__main__';
        const storageKey = isSubElement ? `${variantKey}::${selector}` : variantKey;
        return component.styleOverridesPerVariant?.[storageKey] || {};
    }, [component.styleOverridesPerVariant, variantKey]);

    // F3: Get aggregated style overrides across all modifier selectors
    // Modifiers have multiple selectors (.fullWidth, .loading, etc.) stored under variantKey::.selectorName
    const getModifierStyleOverrides = useCallback((): Record<string, string | number> => {
        const allOverrides = component.styleOverridesPerVariant || {};
        const aggregated: Record<string, string | number> = {};
        const prefix = `${variantKey}::`;
        for (const [key, val] of Object.entries(allOverrides)) {
            if (key.startsWith(prefix)) {
                Object.assign(aggregated, val);
            }
        }
        return aggregated;
    }, [component.styleOverridesPerVariant, variantKey]);

    return {
        variantKey,
        getStyleOverride,
        updateStyleOverride,
        getCurrentStyleOverrides,
        getModifierStyleOverrides,
    };
}

