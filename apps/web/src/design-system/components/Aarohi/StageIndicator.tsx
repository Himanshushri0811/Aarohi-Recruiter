import React from "react";
import { Badge } from "@/design-system/components/Badge";
import { Icon } from "@/design-system/icons";
import { cn } from "@/design-system/lib/utils";

export const INTERVIEW_STAGES = [
  { id: 1, key: "INITIALIZATION", name: "System Setup" },
  { id: 2, key: "WELCOME", name: "Welcome & Introduction" },
  { id: 3, key: "LANGUAGE_SELECTION", name: "Language Selection" },
  { id: 4, key: "INTERVIEW_INSTRUCTIONS", name: "Instructions" },
  { id: 5, key: "WARMUP", name: "Warm-Up" },
  { id: 6, key: "BACKGROUND_QUESTIONS", name: "Background" },
  { id: 7, key: "TECHNICAL_QUESTIONS", name: "Technical Competencies" },
  { id: 8, key: "SITUATIONAL_QUESTIONS", name: "Situational Scenarios" },
  { id: 9, key: "BEHAVIOURAL_QUESTIONS", name: "Behavioral Questions" },
  { id: 10, key: "CANDIDATE_QUESTIONS", name: "Candidate Q&A" },
  { id: 11, key: "CLOSING", name: "Closing Remarks" },
  { id: 12, key: "COMPLETED", name: "Completed" },
] as const;

export interface StageIndicatorProps {
  currentStageIndex: number; // 1 to 12
  language?: "English" | "Hindi" | "Hinglish";
  className?: string;
}

export const StageIndicator: React.FC<StageIndicatorProps> = ({
  currentStageIndex = 7,
  language = "English",
  className,
}) => {
  const stage = INTERVIEW_STAGES[currentStageIndex - 1] || INTERVIEW_STAGES[0];
  const progressPercent = Math.round((currentStageIndex / INTERVIEW_STAGES.length) * 100);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="primary" size="sm">
            Stage {currentStageIndex} of {INTERVIEW_STAGES.length}
          </Badge>
          <span className="text-sm font-semibold text-foreground">
            {stage.name}
          </span>
        </div>
        <Badge variant="secondary" size="sm">
          Language: {language}
        </Badge>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-muted h-2 rounded-full overflow-hidden mt-3">
        <div
          className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
        <span className="flex items-center gap-1">
          <Icon name="AIAssistant" size={12} className="text-primary" />
          Controlled by State Machine
        </span>
        <span className="font-medium text-foreground">{progressPercent}% complete</span>
      </div>
    </div>
  );
};
