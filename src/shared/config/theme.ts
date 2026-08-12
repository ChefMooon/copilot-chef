import { z } from "zod";

export const THEME_PROFILE_VERSION = 1 as const;

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/);

export const ThemeSemanticTokensSchema = z.object({
  background: HexColorSchema,
  surface: HexColorSchema,
  surfaceMuted: HexColorSchema,
  surfaceElevated: HexColorSchema,
  foreground: HexColorSchema,
  foregroundMuted: HexColorSchema,
  border: HexColorSchema,
  primary: HexColorSchema,
  primaryForeground: HexColorSchema,
  accent: HexColorSchema,
  accentForeground: HexColorSchema,
  success: HexColorSchema,
  warning: HexColorSchema,
  danger: HexColorSchema,
  focus: HexColorSchema,
  overlay: HexColorSchema,
  chartGrid: HexColorSchema,
  chartSeries: z.array(HexColorSchema).min(1).max(12),
  heatmap: z.object({
    empty: HexColorSchema,
    low: HexColorSchema,
    medium: HexColorSchema,
    high: HexColorSchema,
    future: HexColorSchema,
  }),
});

export const CustomThemeProfileSchema = z.object({
  version: z.literal(THEME_PROFILE_VERSION),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  name: z.string().trim().min(1).max(80),
  tokens: ThemeSemanticTokensSchema,
});

export type ThemeSemanticTokensV1 = z.infer<typeof ThemeSemanticTokensSchema>;
export type CustomThemeProfileV1 = z.infer<typeof CustomThemeProfileSchema>;

export function parseCustomThemeProfile(value: unknown): CustomThemeProfileV1 | null {
  const result = CustomThemeProfileSchema.safeParse(value);
  return result.success ? result.data : null;
}
