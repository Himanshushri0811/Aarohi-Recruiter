/**
 * Aurora Intelligence - Official Color Palette & Design Tokens
 * 
 * Strict Single Source of Truth for all AI Recruiter & Aarohi interfaces.
 */

export const auroraColors = {
  // Brand Primitives
  primary: {
    name: "Aurora Violet",
    hex: "#7565F6",
    rgb: "117, 101, 246",
    description: "Primary brand action color, active navigation, and key AI interaction accents.",
  },
  primaryDark: {
    name: "Midnight Indigo",
    hex: "#17172B",
    rgb: "23, 23, 43",
    description: "Enterprise anchor color, sidebar navigation, headers, and strong visual hierarchy.",
  },
  secondary: {
    name: "Soft Lavender",
    hex: "#A99CFF",
    rgb: "169, 156, 255",
    description: "Subtle AI highlights, secondary badges, audio waveform gradients, and tags.",
  },
  accent: {
    name: "Mint Green",
    hex: "#48C9A8",
    rgb: "72, 201, 168",
    description: "Success states, high-score indicators, positive candidate evaluations, and active badges.",
  },
  background: {
    name: "Cloud White",
    hex: "#F7F7FC",
    rgb: "247, 247, 252",
    description: "Clean, low-strain canvas background across all dashboard pages.",
  },
  surface: {
    name: "Pure White",
    hex: "#FFFFFF",
    rgb: "255, 255, 255",
    description: "Card surfaces, modals, popovers, and input backgrounds.",
  },
  textPrimary: {
    name: "Deep Ink",
    hex: "#202033",
    rgb: "32, 32, 51",
    description: "High-contrast primary typography ensuring WCAG 2.2 AA compliance.",
  },
  textSecondary: {
    name: "Slate",
    hex: "#74748A",
    rgb: "116, 116, 138",
    description: "Subtitles, metadata, secondary labels, table headers, and hints.",
  },
  border: {
    name: "Mist",
    hex: "#E8E7F0",
    rgb: "232, 231, 240",
    description: "Subtle dividers, card borders, and input boundaries.",
  },

  // Semantic Status Tokens
  status: {
    success: {
      hex: "#48C9A8", // Mint Green
      background: "#EDFBF7",
      border: "#B2EFE0",
      text: "#085744",
    },
    warning: {
      hex: "#F59E0B",
      background: "#FEF7E7",
      border: "#FDE68A",
      text: "#78350F",
    },
    error: {
      hex: "#EF4444",
      background: "#FEF2F2",
      border: "#FECACA",
      text: "#991B1B",
    },
    info: {
      hex: "#3B82F6",
      background: "#EFF6FF",
      border: "#BFDBFE",
      text: "#1E40AF",
    },
  },
} as const;

export type AuroraColorToken = keyof typeof auroraColors;
