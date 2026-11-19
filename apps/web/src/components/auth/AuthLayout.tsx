import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/design-system/components/Card';
import { Icon } from '@/design-system/icons';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  subtitle,
  children,
  footer,
}) => {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-200">
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md">
          <Icon name="AIAssistant" size={22} />
        </div>
        <div>
          <span className="font-bold text-xl tracking-tight text-foreground block">
            Aarohi Recruiter
          </span>
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
            Aurora Intelligence SaaS
          </span>
        </div>
      </div>

      {/* Main Card */}
      <Card className="w-full max-w-md shadow-sm border-border bg-surface">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">
            {title}
          </CardTitle>
          {subtitle && (
            <CardDescription className="text-xs text-muted-foreground mt-1">
              {subtitle}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          {footer && <div className="pt-4 border-t border-border/60 text-center text-xs">{footer}</div>}
        </CardContent>
      </Card>

      {/* Sub-footer note */}
      <p className="mt-6 text-xs text-muted-foreground text-center">
        Enterprise-grade AI recruitment platform &copy; {new Date().getFullYear()} Aarohi
      </p>
    </div>
  );
};
