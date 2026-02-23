import React from 'react';
import { X, Github, Link2 } from 'lucide-react';
import type { UserProfile } from '../lib/userService';

const GoogleIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

interface ProfileModalProps {
    profile: UserProfile;
    onClose: () => void;
    onConnectGoogle: () => void;
    onConnectGithub: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ profile, onClose, onConnectGoogle, onConnectGithub }) => {
    const connectedProviders = profile.connectedProviders || [];
    const isGoogleConnected = connectedProviders.some(p => p.provider === 'google');
    const isGithubConnected = connectedProviders.some(p => p.provider === 'github');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="w-[420px] bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                    <h2 className="text-sm font-semibold text-white">Profile</h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* User Info */}
                <div className="px-5 py-5 border-b border-zinc-800">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-zinc-700 shrink-0">
                            {profile.avatarUrl ? (
                                <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-lg text-zinc-300 font-bold">
                                    {(profile.name?.[0] || '?').toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{profile.name}</p>
                            <p className="text-xs text-zinc-400 truncate">{profile.email}</p>
                            {profile.role && (
                                <span className="inline-block mt-1.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                                    {profile.role}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Connected Accounts */}
                <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Link2 className="w-3.5 h-3.5 text-zinc-500" />
                        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Connected Accounts</h3>
                    </div>

                    <div className="space-y-2">
                        {/* Google */}
                        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-800">
                            <div className="flex items-center gap-2.5">
                                <GoogleIcon className="w-4 h-4" />
                                <span className="text-xs text-white font-medium">Google</span>
                            </div>
                            {isGoogleConnected ? (
                                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                                    Connected
                                </span>
                            ) : (
                                <button
                                    onClick={onConnectGoogle}
                                    className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-2.5 py-0.5 rounded-full font-medium transition-colors"
                                >
                                    Connect
                                </button>
                            )}
                        </div>

                        {/* GitHub */}
                        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-800">
                            <div className="flex items-center gap-2.5">
                                <Github className="w-4 h-4 text-zinc-300" />
                                <span className="text-xs text-white font-medium">GitHub</span>
                            </div>
                            {isGithubConnected ? (
                                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                                    Connected
                                </span>
                            ) : (
                                <button
                                    onClick={onConnectGithub}
                                    className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-2.5 py-0.5 rounded-full font-medium transition-colors"
                                >
                                    Connect
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
