import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;

// Defaults are the public web config of the `sizzly-7c8a9` project — the same one the
// Flutter app ships in lib/firebase_options.dart. Override via .env if needed.
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyDGkw8CuybG2_Azd3RFBm8YfQHn-DxACuQ',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'sizzly-7c8a9.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'sizzly-7c8a9',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'sizzly-7c8a9.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '944000120257',
  appId: env.VITE_FIREBASE_APP_ID || '1:944000120257:web:4b62c5f84442d1a7716b40',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const CUSTOMER_APP_URL = (env.VITE_CUSTOMER_APP_URL || 'https://sizzly.ckbtech.in').replace(
  /\/+$/,
  '',
);

const adminEmails = (env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** With no allowlist configured, any Firebase Auth account may sign in. */
export function isAllowedAdmin(email: string | null | undefined): boolean {
  if (adminEmails.length === 0) return true;
  return !!email && adminEmails.includes(email.toLowerCase());
}

export function tableQrUrl(tableId: string): string {
  return `${CUSTOMER_APP_URL}/?table_id=${encodeURIComponent(tableId)}`;
}
