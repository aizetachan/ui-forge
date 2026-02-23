import React from 'react';

export type ForceState = 'default' | 'hover' | 'focus' | 'active' | 'disabled';

interface StateSelectorProps {
    activeState: ForceState;
    onChange: (state: ForceState) => void;
}

const STATES: { value: ForceState; label: string }[] = [
    { value: 'default', label: 'Default' },
    { value: 'hover', label: 'Hover' },
    { value: 'focus', label: 'Focus' },
    { value: 'active', label: 'Active' },
    { value: 'disabled', label: 'Disabled' },
];

/**
 * State selector toolbar for forcing pseudo-states on the preview component.
 * Renders as a compact pill-group next to the Live Preview label.
 */
export const StateSelector: React.FC<StateSelectorProps> = ({ activeState, onChange }) => {
    return (
        <div style={{
            display: 'flex',
            gap: '2px',
            background: 'rgba(39, 39, 42, 0.9)',
            borderRadius: '8px',
            padding: '3px',
            border: '1px solid rgba(63, 63, 70, 0.6)',
        }}>
            {STATES.map(({ value, label }) => (
                <button
                    key={value}
                    onClick={() => onChange(value)}
                    style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: activeState === value ? 600 : 400,
                        color: activeState === value ? '#fff' : '#a1a1aa',
                        background: activeState === value ? 'rgba(99, 102, 241, 0.7)' : 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        letterSpacing: '0.01em',
                    }}
                >
                    {label}
                </button>
            ))}
        </div>
    );
};
