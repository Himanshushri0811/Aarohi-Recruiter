import React from "react";
import { Card, CardContent } from "./Card";
import { Icon, type AppIconName } from "@/design-system/icons";
import { Badge } from "@/design-system/components/Badge";
import { cn } from "@/design-system/lib/utils";

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: AppIconName;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  variant?: "default" | "ai";
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
  className,
}) => {
  return (
    <Card variant={variant} className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div
            className={cn(
              "h-10 w-10 rounded-md flex items-center justify-center",
              variant === "ai"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-foreground"
            )}
          >
            <Icon name={icon} size="card" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {value}
          </div>
          {trend && (
            <Badge
              variant={trend.isPositive ? "mint" : "danger"}
              size="sm"
            >
              {trend.isPositive ? "+" : ""}{trend.value}
            </Badge>
          )}
        </div>

        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
};
