import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  RecruiterSidebar,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Icon,
} from '@/design-system';
import { useAuth } from '@/contexts/AuthContext';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, currentOrg, organizations, selectOrganization, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getActiveNavId = (): string => {
    const path = location.pathname;
    if (path.startsWith('/jobs')) return 'jobs';
    if (path.startsWith('/candidates')) return 'candidates';
    if (path.startsWith('/interviews')) return 'interviews';
    return 'dashboard';
  };

  const handleNavSelect = (id: string) => {
    switch (id) {
      case 'dashboard':
        navigate('/dashboard');
        break;
      case 'jobs':
        navigate('/jobs');
        break;
      case 'candidates':
        navigate('/candidates');
        break;
      case 'interviews':
        navigate('/interviews');
        break;
      default:
        navigate('/dashboard');
        break;
    }
  };

  const userName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.email || 'User';

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <RecruiterSidebar
        className="hidden lg:flex shrink-0"
        activeId={getActiveNavId()}
        onSelect={handleNavSelect}
        orgName={currentOrg?.name || 'Aarohi Recruiter'}
        userName={userName}
        userRole={currentOrg?.role || 'Admin'}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-border bg-surface px-6 flex items-center justify-between shrink-0 shadow-sm">
          {/* Organization Selector */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Icon name="Organization" size={18} />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:bg-muted p-1.5 rounded-md transition-colors text-left focus:outline-none">
                  <div>
                    <div className="text-sm font-bold text-foreground leading-none flex items-center gap-1.5">
                      <span>{currentOrg?.name || 'My Organization'}</span>
                      <Icon name="Dropdown" size={14} className="text-muted-foreground" />
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      org/{currentOrg?.slug || 'workspace'}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Your Organizations</DropdownMenuLabel>
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => selectOrganization(org)}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{org.name}</span>
                    {currentOrg?.id === org.id && (
                      <Badge variant="mint" size="sm">Active</Badge>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate('/org/new')}
                  icon={<Icon name="Add" size={14} />}
                >
                  Create New Organization
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {currentOrg?.role && (
              <Badge variant="indigo" size="sm" className="hidden sm:inline-flex">
                Role: {currentOrg.role}
              </Badge>
            )}
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-foreground">{userName}</div>
              <div className="text-[11px] text-muted-foreground">{user?.email}</div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              leftIcon={<Icon name="Logout" size={14} />}
            >
              Sign Out
            </Button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
};
