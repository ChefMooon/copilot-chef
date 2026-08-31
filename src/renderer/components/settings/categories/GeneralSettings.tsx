import { useId } from "react";

import { CollapsibleSection } from "../CollapsibleSection";
import styles from "../settings.module.css";
import { ToggleSwitch } from "../ToggleSwitch";
import { Button } from "@/components/ui/button";
import type { UpdateState } from "@/lib/platform";
import type { PlatformCapabilities, RuntimeMode } from "@/lib/platform/types";
import { CategorySettingsPanel } from "./CategorySettingsPanel";

export type GeneralDiagnostics = {
  version: string;
  serverRunning: boolean;
  lanRunning: boolean | null;
};

export type GeneralSettingsProps = {
  active: boolean;
  ariaLabelledBy: string;
  capabilities: PlatformCapabilities;
  checkingForUpdates: boolean;
  closeToTray: boolean;
  description: string;
  diagnostics: GeneralDiagnostics | null;
  id: string;
  launchAtLogin: boolean;
  launchMinimized: boolean;
  lifecycleUnavailableReason: string | null;
  rememberWindowState: boolean;
  runtime: RuntimeMode;
  updateState: UpdateState;
  updatesCheckOnStartup: boolean;
  updatesSupported: boolean;
  onCheckForUpdates: () => void;
  onCloseToTrayChange: (checked: boolean) => void;
  onInstallUpdate: () => void;
  onLaunchAtLoginChange: (checked: boolean) => void;
  onLaunchMinimizedChange: (checked: boolean) => void;
  onRememberWindowStateChange: (checked: boolean) => void;
  onResetWindowLayout: () => void;
  onUpdatesCheckOnStartupChange: (checked: boolean) => void;
};

function ToggleRow(props: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  const labelId = useId();

  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleCopy}>
        <div className={styles.toggleLabel} id={labelId}>
          {props.label}
        </div>
        <div className={styles.toggleDescription}>{props.description}</div>
      </div>
      <ToggleSwitch
        checked={props.checked}
        labelId={labelId}
        onChange={props.onChange}
      />
    </div>
  );
}

export function GeneralSettings({
  active,
  ariaLabelledBy,
  capabilities,
  checkingForUpdates,
  closeToTray,
  description,
  diagnostics,
  id,
  launchAtLogin,
  launchMinimized,
  lifecycleUnavailableReason,
  onCheckForUpdates,
  onCloseToTrayChange,
  onInstallUpdate,
  onLaunchAtLoginChange,
  onLaunchMinimizedChange,
  onRememberWindowStateChange,
  onResetWindowLayout,
  onUpdatesCheckOnStartupChange,
  rememberWindowState,
  runtime,
  updateState,
  updatesCheckOnStartup,
  updatesSupported,
}: GeneralSettingsProps) {
  return (
    <CategorySettingsPanel
      active={active}
      ariaLabelledBy={ariaLabelledBy}
      description={description}
      id={id}
    >
      <CollapsibleSection id="general" label="General">
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Application behavior</h2>
            <p className={styles.cardDescription}>
              Set how Local Recipe Book behaves on this device.
            </p>
          </div>
          {capabilities.lifecycle ? (
            <div className={styles.toggleList} style={{ marginTop: "1rem" }}>
              <ToggleRow
                checked={closeToTray}
                description="Hide the window and keep the app, server, and tray icon running when you close it."
                label="Close to tray"
                onChange={onCloseToTrayChange}
              />
              <ToggleRow
                checked={launchAtLogin}
                description="Start Local Recipe Book when you sign in to your computer."
                label="Launch at login"
                onChange={onLaunchAtLoginChange}
              />
              <ToggleRow
                checked={launchMinimized}
                description="Start hidden in the tray instead of opening the main window."
                label="Launch minimized"
                onChange={onLaunchMinimizedChange}
              />
              <ToggleRow
                checked={rememberWindowState}
                description="Reopen the main window at its last position, size, and maximize state."
                label="Remember window layout"
                onChange={onRememberWindowStateChange}
              />
              <div className={styles.actionsRow}>
                <Button
                  onClick={onResetWindowLayout}
                  type="button"
                  variant="outline"
                >
                  Reset window layout
                </Button>
              </div>
            </div>
          ) : (
            <p className={styles.fieldHint} style={{ marginTop: "1rem" }}>
              {lifecycleUnavailableReason
                ? ` ${lifecycleUnavailableReason}`
                : ""}
            </p>
          )}
          <div className={styles.toggleList} style={{ marginTop: "1rem" }}>
            <ToggleRow
              checked={updatesCheckOnStartup}
              description="Automatically check for app updates on launch (packaged app only)."
              label="Check for updates at startup"
              onChange={onUpdatesCheckOnStartupChange}
            />
          </div>
          {updatesSupported && (
            <div style={{ marginTop: "1rem" }}>
              <p className={styles.fieldHint}>
                Update status:{" "}
                {updateState.status === "downloading"
                  ? `Downloading${updateState.progress?.percent != null ? ` ${Math.round(updateState.progress.percent)}%` : "…"}`
                  : updateState.status === "downloaded"
                    ? `Ready to install${updateState.info.version ? ` (v${updateState.info.version})` : ""}`
                    : updateState.status === "available"
                      ? "Available; downloading in the background"
                      : updateState.status === "error"
                        ? "Update check failed"
                        : "No update available"}
              </p>
              <div className={styles.actionsRow}>
                <Button
                  disabled={checkingForUpdates}
                  onClick={onCheckForUpdates}
                  type="button"
                  variant="outline"
                >
                  {checkingForUpdates ? "Checking…" : "Check for updates"}
                </Button>
                {updateState.status === "downloaded" ? (
                  <Button onClick={onInstallUpdate} type="button">
                    Install & Restart
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
      <CollapsibleSection id="diagnostics" label="Diagnostics">
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Runtime status</h2>
            <p className={styles.cardDescription}>
              Non-sensitive runtime details for troubleshooting. Credentials and
              tokens are never shown here.
            </p>
          </div>
          <div className={styles.twoColumn}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>App version</label>
              <input
                aria-label="App version"
                className={styles.select}
                readOnly
                value={diagnostics?.version ?? "Unavailable"}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Runtime mode</label>
              <input
                aria-label="Runtime mode"
                className={styles.select}
                readOnly
                value={runtime}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Server status</label>
              <input
                aria-label="Server status"
                className={styles.select}
                readOnly
                value={diagnostics?.serverRunning ? "Running" : "Unavailable"}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>LAN status</label>
              <input
                aria-label="LAN status"
                className={styles.select}
                readOnly
                value={
                  diagnostics?.lanRunning === null
                    ? "Unavailable in browser mode"
                    : diagnostics?.lanRunning
                      ? "Running"
                      : "Stopped"
                }
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </CategorySettingsPanel>
  );
}
