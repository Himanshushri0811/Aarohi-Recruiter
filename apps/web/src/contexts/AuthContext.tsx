import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User,
  Organization,
  LoginInput,
  RegisterInput,
  RegisterResponse,
  authApi,
  organizationApi,
  setAccessToken,
} from '@/lib/api';

interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  currentOrg: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  selectOrganization: (org: Organization) => void;
  refreshOrganizations: () => Promise<Organization[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchOrganizations = useCallback(async (): Promise<Organization[]> => {
    try {
      const orgs = await organizationApi.list();
      setOrganizations(orgs);
      setCurrentOrg((prev) => {
        if (prev && orgs.some((o) => o.id === prev.id)) {
          return orgs.find((o) => o.id === prev.id) || orgs[0] || null;
        }
        return orgs[0] || null;
      });
      return orgs;
    } catch {
      setOrganizations([]);
      setCurrentOrg(null);
      return [];
    }
  }, []);

  // Silent refresh on startup
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const refreshRes = await authApi.refresh();
        if (!isMounted) return;

        setAccessToken(refreshRes.accessToken);

        // Fetch organizations after refresh
        const orgs = await fetchOrganizations();
        if (!isMounted) return;

        // Populate user if available from token/refresh or fallback
        if (orgs.length > 0 && !user) {
          // If user details not in refresh payload, placeholder user until full query
          setUser({
            id: 'current-user',
            email: '',
            emailVerified: true,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          });
        }
      } catch {
        // No valid session, proceed as unauthenticated
        setAccessToken(null);
        if (isMounted) {
          setUser(null);
          setOrganizations([]);
          setCurrentOrg(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [fetchOrganizations]);

  const login = async (credentials: LoginInput): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await authApi.login(credentials);
      setAccessToken(res.accessToken);
      setUser(res.user);

      const orgs = await fetchOrganizations();
      if (orgs.length > 0) {
        setCurrentOrg(orgs[0]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterInput) => {
    return await authApi.register(data);
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      setAccessToken(null);
      setUser(null);
      setOrganizations([]);
      setCurrentOrg(null);
    }
  };

  const selectOrganization = (org: Organization) => {
    setCurrentOrg(org);
  };

  const refreshOrganizations = async (): Promise<Organization[]> => {
    return await fetchOrganizations();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        currentOrg,
        isLoading,
        isAuthenticated: !!user || organizations.length > 0,
        login,
        register,
        logout,
        selectOrganization,
        refreshOrganizations,
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
