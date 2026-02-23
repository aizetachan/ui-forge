/**
 * Shared types for PropertiesPanel section components
 */

import { ComponentNode } from '../../types';
import { ComputedStylesData } from '../ReactSandbox';

/**
 * Base props shared by all section components.
 * Each section receives the component data, style override functions,
 * and computed styles from the sandbox to display actual rendered values.
 * 
 * All controls use updateStyleOverride exclusively — inline styles are
 * injected into the sandbox iframe to override the component's CSS.
 */
export interface SectionProps {
    component: ComponentNode;
    onUpdateComponent: (updated: ComponentNode) => void;
    /** Get a style override value for current variant (user-edited) */
    getStyleOverride: (prop: string) => string | number | undefined;
    /** Update a style override for current variant */
    updateStyleOverride: (prop: string, value: string | number) => void;
    /** Computed styles from the sandbox — actual rendered values */
    computedStyles?: ComputedStylesData | null;
}

/**
 * Props for visual section components (Layout, Fill & Border, Typography, etc.)
 * 
 * These sections use a unified value resolution: override > merged CSS > computed.
 * Changes trigger both preview update AND CSS file writeback.
 */
export interface VisualSectionProps {
    isOpen: boolean;
    onToggle: () => void;
    /** Get the effective value for a CSS property.
     *  Priority: style override > merged CSS value > computed style */
    getValue: (prop: string) => string;
    /** Update a CSS property — triggers preview + file write */
    onPropertyChange: (prop: string, value: string) => void;
    /** Computed styles from the sandbox — only for resolved values (e.g. color swatches) */
    computedStyles?: ComputedStylesData | null;
    /** Available tokens for variable picker */
    tokens?: Array<{ name: string; value: string; type: string }>;
}
