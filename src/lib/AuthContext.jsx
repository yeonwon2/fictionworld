import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
    setProfile(data || null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setIsLoadingAuth(false);
      if (initialSession) loadProfile(initialSession.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoadingAuth(false);
      if (nextSession) loadProfile(nextSession.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const user = session?.user ? { ...session.user, role: profile?.role } : null;
  const isAuthenticated = !!session;

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authChecked: !isLoadingAuth,
      logout,
      navigateToLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
