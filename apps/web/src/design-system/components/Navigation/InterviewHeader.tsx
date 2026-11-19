import React from "react";
import { Icon } from "@/design-system/icons";
import { Badge } from "@/design-system/components/Badge";
import { Button } from "@/design-system/components/Button";
import { cn } from "@/design-system/lib/utils";

export interface InterviewHeaderProps {
  jobTitle: string;
  candidateName: string;
  interviewDuration?: string;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onEndInterview?: () => void;
  className?: string;
}

export const InterviewHeader: React.FC<InterviewHeaderProps> = ({
  jobTitle,
  candidateName,
  interviewDuration = "14:20",
  isMuted = false,
  onToggleMute,
  onEndInterview,
  className,
}) => {
  return (
    <header
      className={cn(
        "flex items-center justify-between px-6 py-4 border-b border-border bg-surface shadow-sm",
        className
      )}
    >
      {/* Interview Metadata */}
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Icon name="Aarohi" size={22} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-foreground leading-tight">
              {jobTitle}
            </h1>
            <Badge variant="ai" size="sm">
              <Icon name="AIAssistant" size={12} className="mr-1 text-primary" />
              Aarohi (AI Interviewer)
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Candidate: <span className="text-foreground font-medium">{candidateName}</span>
          </p>
        </div>
      </div>

      {/* Live State & Audio Controls */}
      <div className="flex items-center gap-3">
        {/* Duration Timer */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-foreground text-xs font-medium">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span>{interviewDuration}</span>
        </div>

        {/* Audio Mute Toggle */}
        <Button
          variant={isMuted ? "destructive" : "outline"}
          size="icon"
          onClick={onToggleMute}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          <Icon name={isMuted ? "MicOff" : "MicOn"} size="button" />
        </Button>

        {/* End Interview Action */}
        <Button
          variant="destructive"
          size="sm"
          onClick={onEndInterview}
          leftIcon={<Icon name="Close" size={14} />}
        >
          End Interview
        </Button>
      </div>
    </header>
  );
};
