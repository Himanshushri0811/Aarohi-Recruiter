import {
  LayoutDashboard,
  BriefcaseBusiness,
  Users,
  Video,
  Sparkles,
  AudioWaveform,
  ChartNoAxesCombined,
  CalendarDays,
  MessagesSquare,
  Bell,
  Settings2,
  Building2,
  ShieldCheck,
  Search,
  UserRoundPlus,
  FileUser,
  Shield,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  X,
  Plus,
  ArrowRight,
  Sun,
  Moon,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  Key,
} from "lucide-react";

/**
 * Standard Icon Sizes across AI Recruiter & Aarohi
 */
export const ICON_SIZES = {
  buttonSm: 16,
  button: 18,
  sidebar: 20,
  card: 22,
  header: 24,
  display: 32,
} as const;

export type IconSizeKey = keyof typeof ICON_SIZES;

/**
 * Official Lucide React Icon Mapping Registry
 */
export const AppIcons = {
  // Navigation & Core Features
  Dashboard: LayoutDashboard,
  Jobs: BriefcaseBusiness,
  Candidates: Users,
  Interviews: Video,
  AIAssistant: Sparkles,
  Sparkles: Sparkles,
  Aarohi: AudioWaveform,
  Analytics: ChartNoAxesCombined,
  Calendar: CalendarDays,
  Messages: MessagesSquare,
  Notifications: Bell,
  Settings: Settings2,
  Organization: Building2,
  Authentication: ShieldCheck,

  // Action Icons
  Search: Search,
  AddCandidate: UserRoundPlus,
  Resume: FileUser,
  Security: Shield,
  Logout: LogOut,
  Add: Plus,
  Close: X,
  ArrowNext: ArrowRight,
  Refresh: RotateCcw,
  Mail: Mail,
  Lock: Lock,
  Eye: Eye,
  EyeOff: EyeOff,
  UserCheck: UserCheck,
  Key: Key,

  // Status & Feedback Icons
  Success: CheckCircle2,
  Warning: AlertTriangle,
  Error: AlertCircle,
  Info: Info,

  // Disclosure & Menus
  Dropdown: ChevronDown,
  ChevronNext: ChevronRight,

  // Theme & Media Controls (for Aarohi voice sessions)
  Sun: Sun,
  Moon: Moon,
  MicOn: Mic,
  MicOff: MicOff,
  SpeakerOn: Volume2,
  SpeakerOff: VolumeX,
  Play: Play,
  Pause: Pause,
} as const;

export type AppIconName = keyof typeof AppIcons;

export * from "./Icon";
