/**
 * Aurora Intelligence - Typography Scale & Hierarchy Tokens
 */

export const typography = {
  fontFamily: {
    primary: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },

  scale: {
    display: {
      fontSize: "2.25rem", // 36px
      lineHeight: "2.75rem", // 44px
      fontWeight: "700",
      letterSpacing: "-0.025em",
    },
    h1: {
      fontSize: "1.875rem", // 30px
      lineHeight: "2.25rem", // 36px
      fontWeight: "600",
      letterSpacing: "-0.02em",
    },
    h2: {
      fontSize: "1.5rem", // 24px
      lineHeight: "2rem", // 32px
      fontWeight: "600",
      letterSpacing: "-0.015em",
    },
    h3: {
      fontSize: "1.25rem", // 20px
      lineHeight: "1.75rem", // 28px
      fontWeight: "600",
      letterSpacing: "-0.01em",
    },
    h4: {
      fontSize: "1rem", // 16px
      lineHeight: "1.5rem", // 24px
      fontWeight: "600",
      letterSpacing: "-0.005em",
    },
    bodyLarge: {
      fontSize: "1rem", // 16px
      lineHeight: "1.5rem", // 24px
      fontWeight: "400",
      letterSpacing: "0",
    },
    body: {
      fontSize: "0.875rem", // 14px
      lineHeight: "1.25rem", // 20px
      fontWeight: "400",
      letterSpacing: "0",
    },
    bodyMedium: {
      fontSize: "0.875rem", // 14px
      lineHeight: "1.25rem", // 20px
      fontWeight: "500",
      letterSpacing: "0",
    },
    caption: {
      fontSize: "0.75rem", // 12px
      lineHeight: "1rem", // 16px
      fontWeight: "500",
      letterSpacing: "0.01em",
    },
    tiny: {
      fontSize: "0.6875rem", // 11px
      lineHeight: "0.875rem", // 14px
      fontWeight: "500",
      letterSpacing: "0.02em",
    },
  },

  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;
