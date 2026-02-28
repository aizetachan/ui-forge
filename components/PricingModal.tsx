import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { openCheckout } from '../lib/stripeService';
import { useAuth } from '../hooks/useAuth';

interface PricingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
    const { profile } = useAuth();
    const [processingPlan, setProcessingPlan] = useState<{ planId: string, period: 'monthly' | 'yearly' } | null>(null);
    const [error, setError] = useState<{ planId: string, message: string } | null>(null);

    // Only render if open
    if (!isOpen) return null;

    const currentPlan = profile?.plan || 'free';

    const handleUpgrade = async (planId: string, period: 'monthly' | 'yearly') => {
        setProcessingPlan({ planId, period });
        setError(null);

        try {
            if (planId === 'enterprise') {
                window.location.href = 'mailto:sales@uiforge.com?subject=Enterprise Plan Inquiry';
                setProcessingPlan(null);
                return;
            }
            await openCheckout(planId, period);
            // Let the browser/electron handle the redirect.
        } catch (err: any) {
            console.error('Checkout error:', err);
            setError({ planId, message: err.message || 'Failed to open checkout' });
        } finally {
            setProcessingPlan(null);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="w-full max-w-7xl bg-[#111111] border border-zinc-800/50 rounded-3xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Background Gradients */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

                {/* Close Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors z-[60] pointer-events-auto"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8 sm:p-12 relative z-10">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                            Unlock the Full Power of UI Forge
                        </h2>
                        <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
                            Design, generate, and edit components seamlessly with premium features tailored for individuals, teams, and enterprises.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">

                        {/* Free Plan */}
                        <div className={`p-8 rounded-2xl border transition-all ${currentPlan === 'free' ? 'bg-zinc-900/40 border-zinc-700/50 relative' : 'bg-transparent border-zinc-800'}`}>
                            {currentPlan === 'free' && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-700 text-zinc-200 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                                    Current Plan
                                </div>
                            )}
                            <div className="mb-6">
                                <h3 className="text-xl font-semibold text-white mb-2">Hobby</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold text-white">$0</span>
                                    <span className="text-zinc-500 font-medium">/ forever</span>
                                </div>
                            </div>

                            <ul className="space-y-4 mb-8">
                                {[
                                    '1 Local Repository connected',
                                    'Basic Component Editing',
                                    '10 AI Generation limits',
                                    'Standard Export formats',
                                    'Community Support'
                                ].map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3 text-zinc-300">
                                        <Check className="w-5 h-5 text-zinc-600 shrink-0 mt-0.5" />
                                        <span className="text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="w-full py-2.5 px-4 text-center rounded-xl font-medium border border-zinc-700 text-zinc-400 opacity-50 cursor-not-allowed mt-auto">
                                Included
                            </div>
                        </div>

                        {/* Pro Plan */}
                        <div className={`p-8 rounded-2xl relative ${currentPlan === 'pro' ? 'bg-blue-900/20 border border-blue-500/50' : 'bg-gradient-to-b from-blue-600/10 to-transparent border border-blue-500/30 shadow-[0_0_30px_rgba(37,99,235,0.15)] flex flex-col'}`}>
                            {currentPlan === 'pro' && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-blue-500/20">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                    </span>
                                    Active
                                </div>
                            )}
                            <div className="mb-6">
                                <h3 className="text-xl font-semibold text-white mb-2">Professional</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold text-white">$19</span>
                                    <span className="text-zinc-500 font-medium">/ month</span>
                                </div>
                            </div>

                            <ul className="space-y-4 mb-8 flex-1">
                                {[
                                    'Unlimited Repositories',
                                    'Unlimited AI Chat & Generation',
                                    'Advanced CSS Overrides',
                                    'Interactive Element Selection',
                                    'Component Variant Variations',
                                    'Priority Support'
                                ].map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3 text-zinc-200">
                                        <Check className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                        <span className="font-medium text-white text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {currentPlan === 'pro' ? (
                                <button
                                    disabled
                                    className="w-full py-2.5 px-4 text-center rounded-xl font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 cursor-default"
                                >
                                    Current Plan
                                </button>
                            ) : (
                                <div className="space-y-3 mt-auto">
                                    <button
                                        onClick={() => handleUpgrade('pro', 'monthly')}
                                        disabled={!!processingPlan || currentPlan === 'pro'}
                                        className="w-full relative py-3 px-4 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none group overflow-hidden"
                                    >
                                        <span className="relative flex items-center justify-center gap-2">
                                            {processingPlan?.planId === 'pro' && processingPlan?.period === 'monthly' ? (
                                                <>
                                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    Redirecting...
                                                </>
                                            ) : "Upgrade to Pro"}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => handleUpgrade('pro', 'yearly')}
                                        disabled={!!processingPlan || currentPlan === 'pro'}
                                        className="w-full py-2.5 px-4 rounded-xl font-medium text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 hover:bg-white/5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none text-sm"
                                    >
                                        Pay Annually ($190/yr)
                                    </button>
                                    {error?.planId === 'pro' && <p className="text-red-400 text-xs text-center">{error.message}</p>}
                                </div>
                            )}
                        </div>

                        {/* Team Plan */}
                        <div className={`p-8 rounded-2xl border transition-all ${currentPlan === 'team' ? 'bg-purple-900/20 border-purple-500/50 relative' : 'bg-transparent border-zinc-800 flex flex-col'}`}>
                            {currentPlan === 'team' && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                                    Active
                                </div>
                            )}
                            <div className="mb-6">
                                <h3 className="text-xl font-semibold text-white mb-2">Team</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold text-white">$49</span>
                                    <span className="text-zinc-500 font-medium">/ month / user</span>
                                </div>
                            </div>

                            <ul className="space-y-4 mb-8 flex-1">
                                {[
                                    'Everything in Professional',
                                    'Shared Team Component Library',
                                    'Collaborative Workspaces',
                                    'Advanced Role Permissions',
                                    'Shared Design Tokens',
                                    'Priority API Access'
                                ].map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3 text-zinc-300">
                                        <Check className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                                        <span className="text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {currentPlan === 'team' ? (
                                <button
                                    disabled
                                    className="w-full py-2.5 px-4 text-center rounded-xl font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30 cursor-default"
                                >
                                    Current Plan
                                </button>
                            ) : (
                                <div className="space-y-3 mt-auto">
                                    <button
                                        onClick={() => handleUpgrade('team', 'monthly')}
                                        disabled={!!processingPlan || currentPlan === 'team' || currentPlan === 'enterprise'}
                                        className="w-full relative py-3 px-4 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        <span className="relative flex items-center justify-center gap-2">
                                            {processingPlan?.planId === 'team' && processingPlan?.period === 'monthly' ? (
                                                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            ) : "Upgrade to Team"}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => handleUpgrade('team', 'yearly')}
                                        disabled={!!processingPlan || currentPlan === 'team' || currentPlan === 'enterprise'}
                                        className="w-full py-2.5 px-4 rounded-xl font-medium text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 hover:bg-white/5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none text-sm"
                                    >
                                        Pay Annually ($490/yr)
                                    </button>
                                    {error?.planId === 'team' && <p className="text-red-400 text-xs text-center">{error.message}</p>}
                                </div>
                            )}
                        </div>

                        {/* Enterprise Plan */}
                        <div className={`p-8 rounded-2xl border transition-all ${currentPlan === 'enterprise' ? 'bg-amber-900/20 border-amber-500/50 relative' : 'bg-transparent border-zinc-800 flex flex-col'}`}>
                            {currentPlan === 'enterprise' && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                                    Active
                                </div>
                            )}
                            <div className="mb-6">
                                <h3 className="text-xl font-semibold text-white mb-2">Enterprise</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold text-white">Custom</span>
                                </div>
                            </div>

                            <ul className="space-y-4 mb-8 flex-1">
                                {[
                                    'Everything in Team',
                                    'Self-Hosted / On-Premise',
                                    'White-Labeling Options',
                                    'Dedicated Account Manager',
                                    'Custom Integrations (Jira, Figma)',
                                    'SLA & Phone Support'
                                ].map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3 text-zinc-300">
                                        <Check className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                        <span className="text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {currentPlan === 'enterprise' ? (
                                <button
                                    disabled
                                    className="w-full py-2.5 px-4 text-center rounded-xl font-semibold bg-amber-500/20 text-amber-500 border border-amber-500/30 cursor-default"
                                >
                                    Current Plan
                                </button>
                            ) : (
                                <div className="space-y-3 mt-auto">
                                    <button
                                        onClick={() => handleUpgrade('enterprise', 'yearly')}
                                        className="w-full py-3 px-4 rounded-xl font-semibold text-zinc-900 bg-white hover:bg-zinc-200 active:scale-[0.98] transition-all"
                                    >
                                        Contact Sales
                                    </button>
                                </div>
                            )}
                        </div>

                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-zinc-500 text-sm">
                            Secure payment handling by <span className="font-semibold text-zinc-400">Stripe</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
