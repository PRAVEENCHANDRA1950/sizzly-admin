import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, isAllowedAdmin } from '../lib/firebase';

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export class NotAdminError extends Error {
  constructor() {
    super('This account is not allowed to access the admin panel.');
    this.name = 'NotAdminError';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (next) => {
        if (next && !isAllowedAdmin(next.email)) {
          await signOut(auth);
          next = null;
        }
        setUser(next);
        setLoading(false);
      }),
    [],
  );

  const value: AuthValue = {
    user,
    loading,
    async login(email, password, remember) {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!isAllowedAdmin(credential.user.email)) {
        await signOut(auth);
        throw new NotAdminError();
      }
    },
    logout: () => signOut(auth),
    resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Human-readable messages for Firebase Auth error codes. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof NotAdminError) return error.message;
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled. Turn it on in Firebase Console → Authentication → Sign-in method.';
    case 'auth/configuration-not-found':
      return 'Firebase Authentication is not set up for this project yet. In Firebase Console → Authentication, click "Get started" and enable Email/Password.';
    default:
      return (error as Error)?.message || 'Something went wrong. Please try again.';
  }
}
