import React from "react";
import { cn } from "@/design-system/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/80", className)}
      aria-hidden="true"
      {...props}
    />
  );
};
