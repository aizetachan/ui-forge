import React, { useState, useRef, useEffect } from 'react';
import { Minus, Square, X, LogOut, UserCircle } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../lib/userService';

interface TitleBarProps {
    title?: string;
    user?: User | null;
    profile?: UserProfile | null;
    onLogout?: () => void;
    onProfile?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ title = 'UI Forge', user, profile, onLogout, onProfile }) => {
    const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        if (showMenu) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMenu]);

    if (!isElectron) return null;

    const handleMinimize = () => window.electronAPI?.window?.minimize?.();
    const handleMaximize = () => window.electronAPI?.window?.maximize?.();
    const handleClose = () => window.electronAPI?.window?.close?.();

    const avatarUrl = profile?.avatarUrl || user?.photoURL || null;
    const displayName = profile?.name || user?.displayName || user?.email || '';

    return (
        <div
            className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center select-none shrink-0"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            {/* macOS: Leave space for traffic lights on left */}
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

            {/* Spacer */}
            <div className="flex-1" />

            {/* User Avatar (right side) */}
            {user && (
                <div
                    className="relative flex items-center mr-2"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    ref={menuRef}
                >
                    <button
                        onClick={() => setShowMenu(s => !s)}
                        className="w-6 h-6 rounded-full overflow-hidden border border-zinc-700 hover:border-zinc-500 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
                        title={displayName}
                    >
                        {avatarUrl ? (
                            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 font-bold">
                                {(displayName[0] || '?').toUpperCase()}
                            </div>
                        )}
                    </button>

                    {/* Dropdown */}
                    {showMenu && (
                        <div className="absolute top-8 right-0 w-52 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
                            <div className="px-3 py-2.5 border-b border-zinc-800">
                                <p className="text-xs font-medium text-white truncate">{displayName}</p>
                                <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
                                <span className={`inline-block mt-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono border ${(profile?.plan || 'free') === 'free' ? 'bg-zinc-800 text-zinc-300 border-zinc-700' :
                                        profile?.plan === 'pro' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                            profile?.plan === 'team' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    }`}>
                                    {profile?.plan === 'team' ? 'Ultra' : (profile?.plan || 'free')}
                                </span>
                            </div>
                            <button
                                onClick={() => { setShowMenu(false); onProfile?.(); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                            >
                                <UserCircle className="w-3.5 h-3.5" />
                                Profile
                            </button>
                            <button
                                onClick={() => { setShowMenu(false); onLogout?.(); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border-t border-zinc-800"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                Sign out
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Windows: Window controls on right */}
            {!isMac && (
                <div
                    className="flex items-center h-full"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                    <button onClick={handleMinimize} className="h-full px-4 hover:bg-zinc-700 transition-colors flex items-center justify-center" title="Minimize">
                        <Minus className="w-3.5 h-3.5 text-zinc-400" />
                    </button>
                    <button onClick={handleMaximize} className="h-full px-4 hover:bg-zinc-700 transition-colors flex items-center justify-center" title="Maximize">
                        <Square className="w-3 h-3 text-zinc-400" />
                    </button>
                    <button onClick={handleClose} className="h-full px-4 hover:bg-red-600 transition-colors flex items-center justify-center" title="Close">
                        <X className="w-4 h-4 text-zinc-400 hover:text-white" />
                    </button>
                </div>
            )}
        </div>
    );
};
