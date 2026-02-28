/**
 * Stripe Service (Firestore Triggered)
 * 
 * Creates Stripe Checkout/Portal sessions securely via Firestore documents.
 */

import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { db, auth, app } from './firebase';

/**
 * Helper to generate a unique random ID
 */
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Create a Stripe Checkout session and open it in the browser.
 */
export async function openCheckout(planId: string, period: 'monthly' | 'yearly') {
    return new Promise<string>(async (resolve, reject) => {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error("User must be logged in to create a checkout session");
            }

            const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://forge-d45d8.web.app';
            const sessionId = generateId();
            const sessionRef = doc(db, 'checkout_sessions', sessionId);

            let unsubscribe: () => void;

            // 1. Trigger the Cloud Function by creating the document FIRST
            await setDoc(sessionRef, {
                userId: user.uid,
                planId,
                period,
                originUrl,
                status: 'pending',
                createdAt: new Date().toISOString()
            });

            // 2. Set up the listener AFTER the document exists
            unsubscribe = onSnapshot(sessionRef, (snap) => {
                const data = snap.data();
                if (data) {
                    if (data.url) {
                        unsubscribe(); // Done waiting
                        if (typeof window !== 'undefined') {
                            window.open(data.url, '_blank');
                        }
                        resolve(data.stripeSessionId || sessionId);
                    }
                    if (data.error) {
                        unsubscribe();
                        reject(new Error(data.error));
                    }
                }
            }, (error) => {
                console.error('[StripeService] onSnapshot error:', error);
                unsubscribe();
                reject(error);
            });

        } catch (err) {
            console.error('[StripeService] Caught Checkout Error:', err);
            reject(err);
        }
    });
}

/**
 * Open the Stripe Customer Portal for managing subscriptions.
 */
export async function openCustomerPortal() {
    return new Promise<void>(async (resolve, reject) => {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error("User must be logged in to access the billing portal");
            }

            const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://forge-d45d8.web.app';
            const sessionId = generateId();
            const sessionRef = doc(db, 'customer_portal_sessions', sessionId);

            let unsubscribe: () => void;

            // 1. Trigger the Cloud Function FIRST
            await setDoc(sessionRef, {
                userId: user.uid,
                originUrl,
                status: 'pending',
                createdAt: new Date().toISOString()
            });

            // 2. Set up the listener AFTER
            unsubscribe = onSnapshot(sessionRef, (snap) => {
                const data = snap.data();
                if (data) {
                    if (data.url) {
                        unsubscribe();
                        if (typeof window !== 'undefined') {
                            window.open(data.url, '_blank');
                        }
                        resolve();
                    }
                    if (data.error) {
                        unsubscribe();
                        reject(new Error(data.error));
                    }
                }
            }, (error) => {
                unsubscribe();
                reject(error);
            });

        } catch (err) {
            console.error('Portal Error:', err);
            reject(err);
        }
    });
}

/**
 * Verifies a successful Stripe checkout session after redirecting back to the app.
 * Calls the `verifyCheckout` Gen 2 Cloud Function securely to upgrade the user.
 */
export async function verifyCheckoutSuccess(stripeSessionId: string) {
    return new Promise<void>(async (resolve, reject) => {
        try {
            const user = auth.currentUser;
            const requestId = generateId();
            const requestRef = doc(db, 'verify_checkout_requests', requestId);

            let unsubscribe: () => void;

            await setDoc(requestRef, {
                sessionId: stripeSessionId,
                userId: user?.uid || null,
                status: 'pending',
                createdAt: new Date().toISOString()
            });

            unsubscribe = onSnapshot(requestRef, (snap) => {
                const data = snap.data();
                if (data) {
                    if (data.success) {
                        unsubscribe();
                        resolve();
                    }
                    if (data.error) {
                        unsubscribe();
                        reject(new Error(data.error));
                    }
                }
            }, (error) => {
                console.error('[VerifyCheckout] onSnapshot error:', error);
                unsubscribe();
                reject(error);
            });
        } catch (err) {
            console.error('Verify Event Error:', err);
            reject(err);
        }
    });
}
