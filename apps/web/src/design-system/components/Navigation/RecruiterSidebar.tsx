import React from "react";
import { Icon, type AppIconName } from "@/design-system/icons";
import { Badge } from "@/design-system/components/Badge";
import { cn } from "@/design-system/lib/utils";

export interface NavItem {
  id: string;
  label: string;
  icon: AppIconName;
  badge?: string | number;
  badgeVariant?: "primary" | "mint" | "ai";
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "Dashboard" },
  { id: "jobs", label: "Job Openings", icon: "Jobs", badge: 4 },
  { id: "candidates", label: "Candidates", icon: "Candidates", badge: 28 },
  { id: "interviews", label: "Interviews", icon: "Interviews", badge: "Live", badgeVariant: "mint" },
  { id: "analytics", label: "Analytics", icon: "Analytics" },
  { id: "calendar", label: "Calendar", icon: "Calendar" },
  { id: "settings", label: "Settings", icon: "Settings" },
];

export interface RecruiterSidebarProps {
  activeId?: string;
  onSelect?: (id: string) => void;
  orgName?: string;
  userName?: string;
  userRole?: string;
  className?: string;
}

export const RecruiterSidebar: React.FC<RecruiterSidebarProps> = ({
  activeId = "dashboard",
  onSelect,
  orgName = "Acme Corp",
  userName = "Priya Sharma",
  userRole = "Senior Talent Partner",
  className,
}) => {
  return (
    <aside
      className={cn(
        "flex flex-col w-64 border-r border-border bg-surface h-full select-none",
        className
      )}
    >
      {/* Platform Branding */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center text-white shadow-sm">
          <Icon name="AIAssistant" size={20} />
        </div>
        <div>
          <div className="text-sm font-bold text-foreground tracking-tight flex items-center gap-1.5">
            AI Recruiter
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-secondary text-secondary-foreground">
              SaaS
            </span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Icon name="Organization" size={12} />
            {orgName}
          </p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recruitment Suite
        </div>

        {DEFAULT_NAV_ITEMS.map((item) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect?.(item.id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-all group",
                isActive
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  name={item.icon}
                  size="sidebar"
                  className={cn(
                    "transition-colors",
                    isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <Badge
                  variant={isActive ? "secondary" : (item.badgeVariant || "outline")}
                  size="sm"
                  className={isActive ? "bg-white/20 text-white border-transparent" : ""}
                >
                  {item.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* Aarohi Agent Status Pill in Recruiter Sidebar */}
      <div className="p-3 mx-3 mb-3 rounded-lg border border-primary/20 bg-secondary/30">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Icon name="Aarohi" size={14} className="animate-pulse" />
            Aarohi Voice AI
          </div>
          <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Autonomous interviewer active & ready for candidates.
        </p>
      </div>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-aurora-indigo text-white flex items-center justify-center font-semibold text-xs shrink-0">
            {userName.split(" ").map((n) => n[0]).join("")}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{userRole}</p>
          </div>
        </div>
        <button
          className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-muted"
          aria-label="Logout"
        >
          <Icon name="Logout" size={16} />
        </button>
      </div>
    </aside>
  );
};
