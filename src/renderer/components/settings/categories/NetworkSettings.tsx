import { Suspense, useId, type ElementType } from "react";

import { Button } from "@/components/ui/button";
import type { LanStatus, PairingCodeResult } from "@/lib/platform";

import { CollapsibleSection } from "../CollapsibleSection";
import styles from "../settings.module.css";
import { ToggleSwitch } from "../ToggleSwitch";
import { CategorySettingsPanel } from "./CategorySettingsPanel";

type ConnectionDraft = {
  serverUrl: string;
  token: string;
  mode: "local" | "remote";
};

type LanQrCodeModalProps = {
  apiUrl: string;
  browserUrl: string;
  connectionUrl: string;
  onClose: () => void;
  onCopied: () => void;
};

export type NetworkSettingsProps = {
  active: boolean;
  ariaLabelledBy: string;
  browserConnectionUrl: string;
  canShowLanQrCode: boolean;
  connectionDraft: ConnectionDraft;
  connectionSaved: boolean;
  connectionSaving: boolean;
  description: string;
  id: string;
  lanAdvertisedHostDraft: string;
  lanEnabledDraft: boolean;
  lanPairingAutoRenew: boolean;
  lanPairingCode: PairingCodeResult | null;
  lanPairingError: string | null;
  lanPairingLoading: boolean;
  lanPairingRemainingSeconds: number | null;
  lanQrCodeModal: ElementType<LanQrCodeModalProps>;
  lanQrModalOpen: boolean;
  lanSaving: boolean;
  lanStatus: LanStatus | null;
  lanWebEnabledDraft: boolean;
  machineApiKeyDraft: string;
  platformLanManagement: boolean;
  onAdvertisedHostChange: (value: string) => void;
  onCloseLanQrModal: () => void;
  onConnectionModeChange: (checked: boolean) => void;
  onCopyLanPairingCode: () => void;
  onCreateLanPairingCode: () => void;
  onGenerateMachineToken: () => void;
  onLanEnabledChange: (checked: boolean) => void;
  onLanWebEnabledChange: (checked: boolean) => void;
  onMachineApiKeyChange: (value: string) => void;
  onOpenLanQrModal: () => void;
  onPairingAutoRenewToggle: () => void;
  onRotateMachineToken: () => void;
  onSaveConnection: () => void;
  onSaveLanSettings: () => void;
  onServerUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onLanQrCopied: () => void;
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

export function NetworkSettings({
  active,
  ariaLabelledBy,
  browserConnectionUrl,
  canShowLanQrCode,
  connectionDraft,
  connectionSaved,
  connectionSaving,
  description,
  id,
  lanAdvertisedHostDraft,
  lanEnabledDraft,
  lanPairingAutoRenew,
  lanPairingCode,
  lanPairingError,
  lanPairingLoading,
  lanPairingRemainingSeconds,
  lanQrCodeModal: LanQrCodeModal,
  lanQrModalOpen,
  lanSaving,
  lanStatus,
  lanWebEnabledDraft,
  machineApiKeyDraft,
  platformLanManagement,
  onAdvertisedHostChange,
  onCloseLanQrModal,
  onConnectionModeChange,
  onCopyLanPairingCode,
  onCreateLanPairingCode,
  onGenerateMachineToken,
  onLanEnabledChange,
  onLanWebEnabledChange,
  onMachineApiKeyChange,
  onOpenLanQrModal,
  onPairingAutoRenewToggle,
  onRotateMachineToken,
  onSaveConnection,
  onSaveLanSettings,
  onServerUrlChange,
  onTokenChange,
  onLanQrCopied,
}: NetworkSettingsProps) {
  return (
    <CategorySettingsPanel
      active={active}
      ariaLabelledBy={ariaLabelledBy}
      description={description}
      id={id}
    >
      <CollapsibleSection id="connection" label="Connection">
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Server connection</h2>
            <p className={styles.cardDescription}>
              Configure the app server URL and authentication.
            </p>
          </div>
          <div className={styles.toggleList} style={{ marginBottom: "1rem" }}>
            <ToggleRow
              checked={connectionDraft.mode === "remote"}
              label="Remote mode"
              description="Connect to a remote app server instead of the built-in one."
              onChange={onConnectionModeChange}
            />
          </div>
          {connectionDraft.mode === "remote" && (
            <div className={styles.twoColumn}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Server URL</label>
                <input
                  aria-label="Server URL"
                  className={styles.select}
                  type="text"
                  value={connectionDraft.serverUrl}
                  onChange={(event) => onServerUrlChange(event.target.value)}
                  placeholder="http://localhost:3001"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Auth token</label>
                <input
                  aria-label="Auth token"
                  className={styles.select}
                  type="password"
                  value={connectionDraft.token}
                  onChange={(event) => onTokenChange(event.target.value)}
                  placeholder="Leave blank if not required"
                />
              </div>
            </div>
          )}
          <div className={styles.fieldGroup} style={{ marginTop: "1rem" }}>
            <label className={styles.fieldLabel}>Machine API key</label>
            <input
              aria-label="Machine API key"
              className={styles.select}
              type="password"
              value={machineApiKeyDraft}
              onChange={(event) => onMachineApiKeyChange(event.target.value)}
              placeholder="Token for external PA / automation access"
            />
          </div>
          {platformLanManagement && (
            <div style={{ marginTop: "1rem" }}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>LAN browser access</h3>
                <p className={styles.cardDescription}>
                  Share the browser UI with trusted devices on this network.
                </p>
              </div>
              <div className={styles.toggleList}>
                <ToggleRow
                  checked={lanEnabledDraft}
                  description="Bind the API to the LAN instead of loopback only."
                  label="Enable LAN API"
                  onChange={onLanEnabledChange}
                />
                <ToggleRow
                  checked={lanWebEnabledDraft}
                  description="Serve the browser UI from a separate static web server."
                  label="Enable browser UI server"
                  onChange={onLanWebEnabledChange}
                />
              </div>
              <div
                className={`${styles.twoColumn} ${styles.topAlignedTwoColumn}`}
                style={{ marginTop: "1rem" }}
              >
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>API URL</label>
                  <input
                    aria-label="API URL"
                    className={styles.select}
                    readOnly
                    value={lanStatus?.api.url ?? "Unavailable"}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Browser URL</label>
                  <input
                    aria-label="Browser URL"
                    className={styles.select}
                    readOnly
                    value={lanStatus?.web.url ?? "Unavailable"}
                  />
                  <p className={styles.fieldHint}>
                    Bookmark this after connecting once. The saved browser token
                    keeps trusted devices signed in.
                  </p>
                </div>
              </div>
              <div className={styles.fieldGroup} style={{ marginTop: "1rem" }}>
                <label className={styles.fieldLabel}>Advertised host</label>
                {lanStatus?.candidates && lanStatus.candidates.length > 0 ? (
                  <select
                    aria-label="Advertised host"
                    className={styles.select}
                    value={lanAdvertisedHostDraft}
                    onChange={(event) =>
                      onAdvertisedHostChange(event.target.value)
                    }
                  >
                    {lanStatus.candidates.map((candidate) => (
                      <option key={candidate.address} value={candidate.address}>
                        {candidate.name} — {candidate.address}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label="Advertised host"
                    className={styles.select}
                    type="text"
                    value={lanAdvertisedHostDraft}
                    onChange={(event) =>
                      onAdvertisedHostChange(event.target.value)
                    }
                    placeholder="e.g. 192.168.1.100"
                  />
                )}
              </div>
              {lanStatus?.firewallWarning && (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.75rem 1rem",
                    borderRadius: "0.5rem",
                    background: "var(--color-warning-bg, #fef3c7)",
                    color: "var(--color-warning-text, #92400e)",
                    fontSize: "0.875rem",
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Firewall may be blocking LAN access.</strong> The API
                  is not reachable on the advertised address. On Windows, run:{" "}
                  <code
                    style={{ fontFamily: "monospace", wordBreak: "break-all" }}
                  >{`netsh advfirewall firewall add rule name="Local Recipe Book" dir=in action=allow protocol=TCP localport=${lanStatus.api.port}`}</code>
                </div>
              )}
              <div className={styles.fieldGroup} style={{ marginTop: "1rem" }}>
                <label className={styles.fieldLabel}>Connection URL</label>
                <input
                  aria-label="Connection URL"
                  className={styles.select}
                  readOnly
                  type="text"
                  value={browserConnectionUrl}
                />
                <p className={styles.fieldHint}>
                  Use this link or QR code to pair a trusted device. It contains
                  the browser access token in the URL fragment.
                </p>
              </div>
              <div className={styles.actionsRow} style={{ marginTop: "1rem" }}>
                <Button
                  disabled={lanSaving}
                  onClick={onSaveLanSettings}
                  type="button"
                  variant="outline"
                >
                  {lanSaving ? "Saving..." : "Save LAN settings"}
                </Button>
                <Button
                  onClick={onGenerateMachineToken}
                  type="button"
                  variant="outline"
                >
                  Generate token
                </Button>
                <Button
                  onClick={onRotateMachineToken}
                  type="button"
                  variant="outline"
                >
                  Reset browser access
                </Button>
                <Button
                  aria-describedby={
                    !canShowLanQrCode ? "lan-qr-code-reason" : undefined
                  }
                  aria-disabled={!canShowLanQrCode}
                  onClick={onOpenLanQrModal}
                  type="button"
                  variant="outline"
                >
                  Show QR code
                </Button>
                <Button
                  disabled={lanPairingLoading || !machineApiKeyDraft}
                  onClick={onCreateLanPairingCode}
                  type="button"
                  variant="outline"
                >
                  {lanPairingLoading
                    ? "Creating..."
                    : lanPairingCode
                      ? "Replace PWA pairing code"
                      : "Create PWA pairing code"}
                </Button>
              </div>
              {!canShowLanQrCode ? (
                <p className="sr-only" id="lan-qr-code-reason">
                  Enable LAN API and browser UI, then generate a machine token
                  first.
                </p>
              ) : null}
              {lanPairingCode ? (
                <div
                  className={styles.fieldGroup}
                  style={{ marginTop: "1rem" }}
                >
                  <label className={styles.fieldLabel}>PWA pairing code</label>
                  <div className={styles.actionsRow}>
                    <input
                      aria-label="PWA pairing code"
                      className={styles.select}
                      inputMode="numeric"
                      maxLength={4}
                      readOnly
                      type="text"
                      value={lanPairingCode.code}
                    />
                    <Button
                      disabled={
                        lanPairingLoading ||
                        lanPairingRemainingSeconds === null ||
                        lanPairingRemainingSeconds <= 0
                      }
                      onClick={onCopyLanPairingCode}
                      type="button"
                      variant="outline"
                    >
                      Copy code
                    </Button>
                  </div>
                  <p
                    aria-live="polite"
                    className={styles.fieldHint}
                    role="status"
                  >
                    {lanPairingLoading
                      ? "Creating a new pairing code..."
                      : lanPairingRemainingSeconds === 0
                        ? "This pairing code has expired."
                        : lanPairingRemainingSeconds !== null
                          ? `Expires in ${Math.floor(lanPairingRemainingSeconds / 60)}:${String(lanPairingRemainingSeconds % 60).padStart(2, "0")}`
                          : "Pairing code status unavailable."}
                  </p>
                  <div className={styles.actionsRow}>
                    <Button
                      aria-pressed={lanPairingAutoRenew}
                      onClick={onPairingAutoRenewToggle}
                      type="button"
                      variant="outline"
                    >
                      {lanPairingAutoRenew
                        ? "Stop auto-renew"
                        : "Resume auto-renew"}
                    </Button>
                  </div>
                  <p className={styles.fieldHint}>
                    Enter this code in the installed app before{" "}
                    {new Date(lanPairingCode.expiresAt).toLocaleTimeString()}.
                  </p>
                </div>
              ) : null}
              {lanPairingError ? (
                <p aria-live="polite" className={styles.fieldHint} role="alert">
                  {lanPairingError}
                </p>
              ) : null}
              {lanQrModalOpen &&
              browserConnectionUrl &&
              lanStatus?.api.url &&
              lanStatus?.web.url ? (
                <Suspense fallback={null}>
                  <LanQrCodeModal
                    apiUrl={lanStatus.api.url}
                    browserUrl={lanStatus.web.url}
                    connectionUrl={browserConnectionUrl}
                    onClose={onCloseLanQrModal}
                    onCopied={onLanQrCopied}
                  />
                </Suspense>
              ) : null}
            </div>
          )}
          <div className={styles.actionsRow} style={{ marginTop: "1rem" }}>
            <Button
              disabled={connectionSaving}
              onClick={onSaveConnection}
              type="button"
              variant="outline"
            >
              {connectionSaving
                ? "Saving…"
                : connectionSaved
                  ? "Saved ✓"
                  : "Save connection"}
            </Button>
          </div>
        </div>
      </CollapsibleSection>
    </CategorySettingsPanel>
  );
}
