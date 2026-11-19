import React from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { AppIcons, type AppIconName, ICON_SIZES, type IconSizeKey } from "./index";
import { cn } from "@/design-system/lib/utils";

export interface AppIconProps extends Omit<LucideProps, "size"> {
  name: AppIconName;
  size?: IconSizeKey | number;
  className?: string;
  "aria-label"?: string;
}

/**
 * Enforces Lucide-only usage, consistent stroke width (1.85),
 * and standard sizing across the entire application.
 */
export const Icon: React.FC<AppIconProps> = ({
  name,
  size = "button",
  strokeWidth = 1.85,
  className,
  "aria-label": ariaLabel,
  ...props
}) => {
  const IconComponent = AppIcons[name] as LucideIcon;
  if (!IconComponent) {
    console.warn(`[Icon] Icon "${name}" does not exist in Aurora Intelligence icon registry.`);
    return null;
  }

  const computedSize = typeof size === "number" ? size : ICON_SIZES[size];

  return (
    <IconComponent
      size={computedSize}
      strokeWidth={strokeWidth}
      className={cn("shrink-0 transition-colors", className)}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
      role={ariaLabel ? "img" : "presentation"}
      {...props}
    />
  );
};
