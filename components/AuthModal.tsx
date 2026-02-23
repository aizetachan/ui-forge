import React, { useState } from 'react';
import { Github, Loader2 } from 'lucide-react';

const GoogleIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

interface AuthModalProps {
    loginWithGithub: () => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    onCancel: () => void;
    isLoading: boolean;
    error: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({ loginWithGithub, loginWithGoogle, onCancel, isLoading, error }) => {
    // Track which provider is connecting (null = none)
    const [connectingProvider, setConnectingProvider] = useState<'github' | 'google' | null>(null);

    const handleLogin = async (provider: 'github' | 'google') => {
        setConnectingProvider(provider);
        try {
            if (provider === 'github') await loginWithGithub();
            else await loginWithGoogle();
        } finally {
            setConnectingProvider(null);
        }
    };

    // If Firebase is restoring session on mount, hide modal
    if (isLoading && !connectingProvider) return null;

    const isDisabled = !!connectingProvider;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="w-[400px] bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-2xl p-8 flex flex-col items-center pointer-events-auto">

                <div className="w-16 h-16 flex items-center justify-center mb-6">
                    <svg className="w-12 h-12 text-white" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M77.7041 15.4326C79.9132 15.4326 81.7041 17.2235 81.7041 19.4326V26.5176C81.7039 37.4554 73.3073 46.4294 62.6084 47.3516C61.6462 56.9437 53.5497 64.4326 43.7041 64.4326H38.6455C37.8806 74.2247 29.6926 81.9326 19.7041 81.9326H17.7041C16.6685 81.9326 15.8172 81.1453 15.7148 80.1367L15.7041 79.9326C15.7041 79.7996 15.7063 79.6666 15.709 79.5342C15.7073 79.5005 15.7041 79.4667 15.7041 79.4326V37.4326C15.7041 25.2824 25.5538 15.4326 37.7041 15.4326H77.7041ZM34.6279 64.4434C27.0068 64.7219 20.7898 70.5022 19.832 77.9307L20.0908 77.9277C27.6894 77.7354 33.8828 71.8921 34.6279 64.4434ZM37.7041 47.4326C27.763 47.4326 19.7041 55.4915 19.7041 65.4326V68.1006C23.2674 63.4397 28.8841 60.4326 35.2041 60.4326H43.7041C51.3101 60.4326 57.5934 54.7712 58.5713 47.4326H37.7041ZM37.7041 19.4326C27.763 19.4326 19.7041 27.4915 19.7041 37.4326V52.7812C23.6855 47.1269 30.2631 43.4326 37.7041 43.4326H60.7041C60.7181 43.4326 60.7321 43.4343 60.7461 43.4346C60.7604 43.4343 60.7747 43.4326 60.7891 43.4326C70.1308 43.4325 77.7039 35.8593 77.7041 26.5176V19.4326H37.7041Z" fill="currentColor" />
                    </svg>
                </div>

                <h2 className="text-xl font-bold text-white mb-2">Welcome to UI Forge</h2>
                <p className="text-sm text-zinc-400 text-center mb-8">
                    Sign in to access your repositories, generate components, and sync changes.
                </p>

                {error && error !== "Firebase configuration is missing in .env.local" && (
                    <div className="w-full bg-red-500/10 border border-red-500/50 text-red-500 text-xs px-3 py-2 rounded mb-6 text-center">
                        {error}
                    </div>
                )}

                <div className="w-full flex flex-col gap-3">
                    <button
                        onClick={() => handleLogin('github')}
                        disabled={isDisabled}
                        className="w-full flex items-center justify-center gap-3 bg-zinc-100 hover:bg-white text-zinc-900 font-medium py-2.5 px-4 rounded transition-colors disabled:opacity-50"
                    >
                        {connectingProvider === 'github' ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Github className="w-5 h-5" />
                        )}
                        Continue with GitHub
                    </button>

                    <button
                        onClick={() => handleLogin('google')}
                        disabled={isDisabled}
                        className="w-full flex items-center justify-center gap-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-medium py-2.5 px-4 rounded transition-colors disabled:opacity-50"
                    >
                        {connectingProvider === 'google' ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <GoogleIcon className="w-5 h-5" />
                        )}
                        Continue with Google
                    </button>
                </div>

                {!connectingProvider && (
                    <p className="text-[10px] text-zinc-500 mt-8 text-center px-4">
                        By signing in, you agree to our Terms of Service and Privacy Policy. First-time registrations will be marked as pending until approved by an administrator.
                    </p>
                )}
            </div>
        </div>
    );
};
