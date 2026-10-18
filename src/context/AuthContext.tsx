import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeToAuth, signInWithGoogle, signOut, requestContactsPermission, checkRedirectResult } from '../services/auth';
import type { UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGlobalAdmin: boolean;
  userRole: UserRole;
  isAuthorized: boolean;
  login: (forceSelect?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  requestContactsAuth: () => Promise<void>;
  checkChurchAuthorization: (churchId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('viewer');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeChurchId, setActiveChurchId] = useState<string | null>(null);

  useEffect(() => {
    // Check for any redirect auth completion
    checkRedirectResult().catch(console.warn);

    const unsubscribeAuth = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsGlobalAdmin(false);
        setUserRole('viewer');
        setIsAuthorized(false);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to global_admins collection for the current user UID
  useEffect(() => {
    if (!user) return;

    const adminDocRef = doc(db, 'global_admins', user.uid);
    const unsubscribeAdmin = onSnapshot(adminDocRef, (snap) => {
      const isOwner = snap.exists();
      setIsGlobalAdmin(isOwner);
      if (isOwner) {
        setUserRole('owner');
        setIsAuthorized(true);
      }
      setLoading(false);
    }, (error) => {
      console.warn('Could not read global_admins status:', error);
      setIsGlobalAdmin(false);
      setLoading(false);
    });

    return () => unsubscribeAdmin();
  }, [user]);

  // Listen to church-specific misters document for role & authorization
  useEffect(() => {
    if (!user || !user.email || !activeChurchId || isGlobalAdmin) return;

    const misterDocRef = doc(db, 'churches', activeChurchId, 'misters', user.email.toLowerCase());
    const unsubscribeMister = onSnapshot(misterDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const active = data?.active === true;
        const role = (data?.churchRole?.toLowerCase() === 'admin') ? 'Admin' : 'viewer';
        setIsAuthorized(active);
        setUserRole(role);
      } else {
        setIsAuthorized(false);
        setUserRole('viewer');
      }
    }, (error) => {
      console.warn('Error reading mister authorization:', error);
      setIsAuthorized(false);
    });

    return () => unsubscribeMister();
  }, [user, activeChurchId, isGlobalAdmin]);

  const checkChurchAuthorization = useCallback((churchId: string) => {
    setActiveChurchId(churchId);
  }, []);

  const login = async (forceSelect: boolean = false) => {
    setLoading(true);
    try {
      await signInWithGoogle({ forceSelect });
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut();
  };

  const requestContactsAuth = async () => {
    await requestContactsPermission();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isGlobalAdmin,
        userRole,
        isAuthorized,
        login,
        logout,
        requestContactsAuth,
        checkChurchAuthorization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
