# Aurora Intelligence — AI Recruiter Professional Design System

Production-grade enterprise UI design system for the **AI Recruiter** platform and its conversational AI interviewer, **Aarohi**.

---

## 1. Design Direction: Aurora Intelligence

Aurora Intelligence delivers a clean, high-contrast, trustworthy visual identity comparable in polish and clarity to enterprise SaaS platforms like Linear and Stripe.

- **Primary Canvas**: Clean white/cloud surfaces with zero visual clutter.
- **Visual Anchor**: Midnight Indigo (`#17172B`) provides solid structural contrast for enterprise navigation.
- **AI Accents**: Aurora Violet (`#7565F6`) and Soft Lavender (`#A99CFF`) are reserved for primary actions and conversational AI presence.
- **Confidence & Success**: Mint Green (`#48C9A8`) signals rubric alignments, completed interviews, and positive evaluations.

---

## 2. Design Tokens Reference

### Official Palette

| Token Name | CSS Variable | Hex | Semantic Role |
|---|---|---|---|
| **Aurora Violet** | `--aurora-violet` | `#7565F6` | Primary action button, active tab, Aarohi audio pulse |
| **Midnight Indigo** | `--midnight-indigo` | `#17172B` | Navigation sidebar, structural headers, dark theme anchor |
| **Soft Lavender** | `--soft-lavender` | `#A99CFF` | Waveform highlights, secondary tags, subtle AI glows |
| **Mint Green** | `--mint-green` | `#48C9A8` | Positive feedback, high match %, active badges |
| **Cloud White** | `--cloud-white` | `#F7F7FC` | Dashboard canvas background |
| **Pure White** | `--pure-white` | `#FFFFFF` | Card surfaces, modal containers, input backgrounds |
| **Deep Ink** | `--deep-ink` | `#202033` | Primary typography (WCAG 2.2 AA compliant contrast) |
| **Slate** | `--slate` | `#74748A` | Subtitles, metadata, timestamps, placeholder text |
| **Mist** | `--mist` | `#E8E7F0` | Subtle card borders, input borders, table row dividers |

---

## 3. Strict Lucide React Icon System

All icons are rendered exclusively using `lucide-react`.

### Sizing Rules

| UI Context | Dimension | Stroke Width | Lucide Icon Examples |
|---|---|---|---|
| **Buttons (sm/md)** | 16px – 18px | 1.85 | `Plus`, `Search`, `ArrowRight`, `Close` |
| **Sidebar Navigation** | 20px | 1.85 | `LayoutDashboard`, `BriefcaseBusiness`, `Users`, `Video` |
| **Dashboard Metric Cards** | 22px | 1.85 | `ChartNoAxesCombined`, `AudioWaveform`, `Sparkles` |
| **Page / Section Headers**| 24px | 1.85 | `Building2`, `ShieldCheck` |

### Official Icon Mapping Registry

```typescript
import { Icon } from "@/design-system";

<Icon name="Dashboard" size="sidebar" />
<Icon name="Candidates" size="button" />
<Icon name="Aarohi" size="card" />
<Icon name="AIAssistant" size="buttonSm" />
```

---

## 4. Reusable Component Inventory

- `Button`: Primary, Secondary, Outline, Ghost, Destructive, Mint Accent, AI Gradient, Icon-only.
- `Input` & `SearchInput`: Text fields with automatic clear button, left/right icon slots, and validation feedback.
- `Badge`: Primary, Indigo, Lavender, Mint, Warning, Danger, Outline, AI Gradient.
- `Card` & `StatCard`: Enterprise metrics card with trends and icon containers.
- `Table`: Accessible tabular data display with hover and selection states.
- `Dialog`: Accessible Radix modal with focus trap and backdrop blur.
- `DropdownMenu`: Popover menu with icon items and group separators.
- `Toast`: Dynamic toast notification provider supporting Success, AI, and Error alerts.
- `Skeleton` & `Spinner`: Accessible loading indicators.
- `EmptyState` & `ErrorState`: Friendly, actionable feedback components.
- `RecruiterSidebar`: Enterprise recruiter navigation suite.
- `InterviewHeader`: Live candidate interview room navigation bar.
- `AudioWaveform`: Dynamic speech wave visualization for Aarohi (Speaking, Listening, Thinking, Idle).
- `StageIndicator`: Progress tracker for the 12 interview stages.

---

## 5. Development & Verification

### Run Local Development Server
```bash
npm run dev
```
*Visit `http://localhost:3000` to interact with the full Aurora Intelligence Design System showcase.*

### Production Typecheck & Build
```bash
npm run build
```
