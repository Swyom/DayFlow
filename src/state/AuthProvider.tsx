import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as auth from '../services/auth';
import type { PublicAccount } from '../services/auth';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  user: PublicAccount | null;
  signUp: typeof auth.signUp;
  logIn: typeof auth.logIn;
  logOut: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  /** Requires the account password (re-authentication). */
  deleteAccount: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<PublicAccount | null>(null);

  useEffect(() => {
    auth
      .restoreSession()
      .then((account) => {
        setUser(account);
        setStatus(account ? 'signedIn' : 'signedOut');
      })
      .catch(() => setStatus('signedOut'));
  }, []);

  const signIn = useCallback((account: PublicAccount) => {
    setUser(account);
    setStatus('signedIn');
    return account;
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>((input) => auth.signUp(input).then(signIn), [signIn]);
  const logIn = useCallback<AuthContextValue['logIn']>((input) => auth.logIn(input).then(signIn), [signIn]);

  const logOut = useCallback(async () => {
    await auth.logOut();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const updateName = useCallback(
    async (name: string) => {
      if (!user) return;
      setUser(await auth.updateProfile(user.id, { name }));
    },
    [user],
  );

  const deleteAccount = useCallback(
    async (password: string) => {
      if (!user) return;
      await auth.deleteAccount(user.id, password);
      setUser(null);
      setStatus('signedOut');
    },
    [user],
  );

  const value = useMemo(
    () => ({ status, user, signUp, logIn, logOut, updateName, deleteAccount }),
    [status, user, signUp, logIn, logOut, updateName, deleteAccount],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** For screens that only render when signed in. */
export function useCurrentUser(): PublicAccount {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser called while signed out');
  return user;
}
