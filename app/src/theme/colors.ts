// Ported 1:1 from the design mockup's established tokens (the .dc.html
// screens: Main, Gissa, Karta, Onboarding, Bekrafta, Historik). Keep these
// in sync if the mockup's palette ever changes.
export const colors = {
  background: "#F2EFE6",
  foreground: "#1C1A17",

  card: "#FBF9F4",
  cardForeground: "#1C1A17",

  primary: "#D9491F", // terracotta - the one primary CTA color
  primaryForeground: "#F2EFE6",

  link: "#7A2A15",
  linkPressed: "#5A1E0F",

  accentGreen: "#2A4536", // "gissning pågår" / prediction-in-progress state only

  muted: "#EAE5D6", // nav bar / section-label background
  mutedForeground: "#55504A", // secondary text
  border: "#C7BFAE",
  faintBorder: "rgba(28,26,23,0.12)",

  placeholder: "#9A9384",
  disabledIcon: "#8A8477",
} as const;

export const fonts = {
  display: "BigShoulders-ExtraBold", // Big Shoulders 800 - loaded via expo-font, see src/theme/fonts.ts
  displayBold: "BigShoulders-Bold", // Big Shoulders 700
  body: "SourceSerif4-Regular", // Source Serif 4 400
  bodySemibold: "SourceSerif4-SemiBold", // Source Serif 4 600
  mono: "JetBrainsMono-Regular",
  monoMedium: "JetBrainsMono-Medium",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 32,
} as const;

export const radius = {
  lg: 10,
  full: 999,
} as const;
