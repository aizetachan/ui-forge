import React from 'react';
import { Minus, Square, X } from 'lucide-react';

interface TitleBarProps {
    title?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ title = 'UI Forge' }) => {
    // Check if running in Electron
    const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

    // Detect platform (macOS has traffic lights on left)
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    if (!isElectron) {
        // Don't render title bar in web mode
        return null;
    }

    const handleMinimize = () => {
        window.electronAPI?.window?.minimize?.();
    };

    const handleMaximize = () => {
        window.electronAPI?.window?.maximize?.();
    };

    const handleClose = () => {
        window.electronAPI?.window?.close?.();
    };

    return (
        <div
            className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center select-none shrink-0"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            {/* macOS: Leave space for traffic lights on left - needs ~78px */}
            {isMac && <div className="w-[78px] shrink-0" />}

            {/* App Icon & Title */}
            <div
                className="flex items-center gap-2 px-3"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                <img src="/logouiforge.svg" alt="UI Forge" className="w-5 h-5" />
                <span className="text-xs font-semibold text-zinc-300">{title}</span>
                <span className="text-[10px] text-zinc-600">v1.0.0</span>
            </div>

            {/* Spacer - This area is draggable */}
            <div className="flex-1" />

            {/* Windows: Window controls on right */}
            {!isMac && (
                <div
                    className="flex items-center h-full"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                    <button
                        onClick={handleMinimize}
                        className="h-full px-4 hover:bg-zinc-700 transition-colors flex items-center justify-center"
                        title="Minimize"
                    >
                        <Minus className="w-3.5 h-3.5 text-zinc-400" />
                    </button>
                    <button
                        onClick={handleMaximize}
                        className="h-full px-4 hover:bg-zinc-700 transition-colors flex items-center justify-center"
                        title="Maximize"
                    >
                        <Square className="w-3 h-3 text-zinc-400" />
                    </button>
                    <button
                        onClick={handleClose}
                        className="h-full px-4 hover:bg-red-600 transition-colors flex items-center justify-center"
                        title="Close"
                    >
                        <X className="w-4 h-4 text-zinc-400 hover:text-white" />
                    </button>
                </div>
            )}
        </div>
    );
};
