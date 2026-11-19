import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/design-system/components/Loading/Spinner';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, organizations } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background gap-3">
        <Spinner size="lg" className="text-primary" />
        <span className="text-xs text-muted-foreground font-medium animate-pulse">
          Authenticating session...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is authenticated but has no organizations yet, redirect to organization onboarding
  if (organizations.length === 0 && location.pathname !== '/org/new') {
    return <Navigate to="/org/new" replace />;
  }

  return <>{children}</>;
};
