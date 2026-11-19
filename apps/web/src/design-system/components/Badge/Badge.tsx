import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/design-system/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        primary:
          "bg-primary/10 text-primary border border-primary/20",
        indigo:
          "bg-aurora-indigo text-white",
        secondary:
          "bg-secondary text-secondary-foreground border border-secondary/30",
        mint:
          "bg-[#EDFBF7] text-[#085744] border border-[#B2EFE0] font-semibold dark:bg-[#0C332A] dark:text-[#5EEAD4] dark:border-[#134E48]",
        outline:
          "border border-border text-muted-foreground bg-transparent",
        warning:
          "bg-[#FEF7E7] text-[#78350F] border border-[#FDE68A] dark:bg-[#382006] dark:text-[#FCD34D] dark:border-[#78350F]",
        danger:
          "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] dark:bg-[#3F1111] dark:text-[#FCA5A5] dark:border-[#7F1D1D]",
        ai:
          "bg-gradient-to-r from-primary/15 to-[#8F81FF]/20 text-primary border border-primary/30 shadow-[0_0_10px_rgba(117,101,246,0.15)]",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px] gap-1",
        md: "px-2.5 py-0.5 text-xs gap-1.5",
        lg: "px-3 py-1 text-sm gap-2",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant,
  size,
  icon,
  children,
  ...props
}) => {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </div>
  );
};
