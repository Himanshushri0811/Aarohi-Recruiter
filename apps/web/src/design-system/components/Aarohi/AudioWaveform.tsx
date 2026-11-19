import React from "react";
import { cn } from "@/design-system/lib/utils";

export type AudioWaveState = "idle" | "speaking" | "listening" | "thinking";

export interface AudioWaveformProps {
  state?: AudioWaveState;
  className?: string;
  barCount?: number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  state = "speaking",
  className,
  barCount = 18,
}) => {
  // Height variations for natural audio wave appearance
  const defaultHeights = [
    24, 40, 68, 85, 52, 90, 75, 45, 95, 60, 80, 48, 88, 70, 50, 65, 38, 20,
  ];

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5 h-28 px-6 py-4 rounded-xl transition-all",
        state === "speaking" && "bg-gradient-to-b from-secondary/10 to-transparent",
        state === "listening" && "bg-[#EDFBF7]/30 dark:bg-[#0C332A]/20",
        state === "thinking" && "bg-muted/30",
        className
      )}
      aria-label={`Aarohi audio status: ${state}`}
      role="region"
    >
      {Array.from({ length: barCount }).map((_, index) => {
        const heightPercent = defaultHeights[index % defaultHeights.length];
        const delay = (index * 0.08).toFixed(2);

        return (
          <div
            key={index}
            className={cn(
              "w-1.5 rounded-full transition-all duration-300",
              state === "speaking" &&
                "bg-gradient-to-t from-primary to-secondary animate-waveform",
              state === "listening" &&
                "bg-accent animate-pulse",
              state === "thinking" &&
                "bg-slate/50 animate-pulse-subtle",
              state === "idle" && "bg-border h-3"
            )}
            style={{
              height: state === "idle" ? "6px" : `${heightPercent}%`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
};
