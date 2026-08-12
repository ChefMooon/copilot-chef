import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import {
  APP_SETTING_DEFAULTS,
  resolveUiThemePreference,
  type AppSettingTheme,
} from "@shared/config/settings";
import { getPlatform } from "@/lib/platform";

export type UiPreferenceState = {
  theme: AppSettingTheme;
  setThemePreference: (theme: AppSettingTheme) => Promise<void>;
};

const DEFAULT_PREFERENCES: UiPreferenceState = {
  theme: APP_SETTING_DEFAULTS.ui_theme,
  setThemePreference: async () => {},
};

const PreferencesContext = createContext<UiPreferenceState>(DEFAULT_PREFERENCES);

function getSystemThemePreference(): AppSettingTheme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveEffectiveTheme(theme: unknown): AppSettingTheme {
  const normalized = resolveUiThemePreference(theme);
  if (normalized === "system") {
    return getSystemThemePreference();
  }
  return normalized;
}

export function PreferenceProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<AppSettingTheme>(() => {
    const initialValue = APP_SETTING_DEFAULTS.ui_theme;
    const preferred = resolveUiThemePreference(initialValue);
    return resolveEffectiveTheme(preferred);
  });

  const syncTheme = useCallback(async () => {
    try {
      const value = await getPlatform().getSetting("ui_theme");
      const resolved = resolveEffectiveTheme(value);
      setTheme(resolved);
      document.documentElement.dataset.theme = resolved;
    } catch {
      // Keep the initial effective theme when persisted settings are unavailable.
    }
  }, []);

  const setThemePreference = useCallback(async (nextTheme: AppSettingTheme) => {
    await getPlatform().setSetting("ui_theme", nextTheme);
    const resolved = resolveEffectiveTheme(nextTheme);
    setTheme(resolved);
    document.documentElement.dataset.theme = resolved;
  }, []);

  useEffect(() => {
    void syncTheme();

    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    const listener = () => {
      const value = getPlatform().getSetting("ui_theme");
      void value
        .then((stored) => {
          const resolved = resolveEffectiveTheme(stored);
          setTheme(resolved);
          document.documentElement.dataset.theme = resolved;
        })
        .catch(() => {
          // Keep the current effective theme when persisted settings are unavailable.
        });
    };

    mediaQuery?.addEventListener?.("change", listener);
    return () => {
      mediaQuery?.removeEventListener?.("change", listener);
    };
  }, [syncTheme]);

  const value = useMemo<UiPreferenceState>(
    () => ({ theme, setThemePreference }),
    [setThemePreference, theme]
  );

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

export function usePreferences(): UiPreferenceState {
  return useContext(PreferencesContext);
}
