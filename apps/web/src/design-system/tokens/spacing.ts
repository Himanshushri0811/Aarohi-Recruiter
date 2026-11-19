/**
 * Aurora Intelligence - Spacing, Radii & Elevation Tokens
 */

export const spacing = {
  // Spacing Scale (4px base)
  0: "0px",
  1: "0.25rem", // 4px
  2: "0.5rem",  // 8px
  3: "0.75rem", // 12px
  4: "1rem",    // 16px
  5: "1.25rem", // 20px
  6: "1.5rem",  // 24px
  8: "2rem",    // 32px
  10: "2.5rem", // 40px
  12: "3rem",   // 48px
  16: "4rem",   // 64px
} as const;

export const radii = {
  none: "0px",
  sm: "0.375rem",  // 6px - Badges, tiny tags
  md: "0.5rem",    // 8px - Inputs, buttons
  lg: "0.625rem",  // 10px - Standard Cards, Dialogs, Dropdowns (Aurora Default)
  xl: "0.875rem",  // 14px - Outer Containers
  full: "9999px",  // Pills, Avatars
} as const;

export const elevation = {
  none: "none",
  subtle: "0 1px 2px 0 rgba(23, 23, 43, 0.04)",
  card: "0 1px 3px 0 rgba(23, 23, 43, 0.06), 0 1px 2px -1px rgba(23, 23, 43, 0.04)",
  dropdown: "0 4px 6px -1px rgba(23, 23, 43, 0.08), 0 2px 4px -2px rgba(23, 23, 43, 0.04)",
  modal: "0 20px 25px -5px rgba(23, 23, 43, 0.1), 0 8px 10px -6px rgba(23, 23, 43, 0.04)",
  aiGlow: "0 0 15px rgba(117, 101, 246, 0.25)",
} as const;
