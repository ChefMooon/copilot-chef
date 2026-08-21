import { useEffect, useState } from "react";
import { toString as toQrSvg } from "qrcode";

import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/ModalShell";

import styles from "./settings.module.css";

type LanQrCodeModalProps = {
  connectionUrl: string;
  browserUrl: string;
  apiUrl: string;
  onClose: () => void;
  onCopied?: () => void;
};

function fallbackCopyToClipboard(value: string) {
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "true");
  input.style.position = "absolute";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
}

export function LanQrCodeModal({
  connectionUrl,
  browserUrl,
  apiUrl,
  onClose,
  onCopied,
}: LanQrCodeModalProps) {
  const [svgMarkup, setSvgMarkup] = useState("");
  const [isCopying, setIsCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void toQrSvg(connectionUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      type: "svg",
      width: 256,
    })
      .then((markup) => {
        if (!cancelled) {
          setSvgMarkup(markup);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCopyError("Could not generate the QR code.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connectionUrl]);

  async function handleCopy() {
    setIsCopying(true);
    setCopyError(null);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(connectionUrl);
      } else {
        fallbackCopyToClipboard(connectionUrl);
      }
      onCopied?.();
    } catch {
      setCopyError("Could not copy the connection link.");
    } finally {
      setIsCopying(false);
    }
  }

  return (
    <ModalShell
      ariaLabel="LAN QR code"
      bodyClassName={styles.personaModalBody}
      className={`${styles.personaModalPanel} ${styles.lanQrModalPanel}`}
      closeLabel="Close LAN pairing dialog"
      onClose={onClose}
      open
      eyebrow="LAN Access"
      title="Pair a trusted device"
      footerLeft={<span className={styles.lanQrFooterNote}>The token is saved in the browser and stripped from the address bar after pairing.</span>}
      footerRight={
        <>
          <Button onClick={onClose} type="button" variant="outline">Close</Button>
          <Button autoFocus disabled={isCopying} onClick={() => void handleCopy()} type="button">
            {isCopying ? "Copying..." : "Copy connection link"}
          </Button>
        </>
      }
    >
          <div className={styles.lanQrModalGrid}>
            <div className={styles.lanQrCodeCard}>
              {svgMarkup ? (
                <div
                  aria-label="Connection QR code"
                  className={styles.lanQrCodeSvg}
                  dangerouslySetInnerHTML={{ __html: svgMarkup }}
                />
              ) : (
                <div className={styles.lanQrCodeLoading}>Generating QR code...</div>
              )}
            </div>

            <div className={styles.lanQrInfo}>
              <div className={styles.lanQrFieldGroup}>
                <span className={styles.personaFormLabel}>Browser URL</span>
                <code className={styles.lanQrCodeText}>{browserUrl}</code>
              </div>

              <div className={styles.lanQrFieldGroup}>
                <span className={styles.personaFormLabel}>API URL</span>
                <code className={styles.lanQrCodeText}>{apiUrl}</code>
              </div>

              <div className={styles.lanQrFieldGroup}>
                <label className={styles.personaFormLabel} htmlFor="lan-connection-url">
                  Connection link
                </label>
                <input
                  className={styles.textInput}
                  id="lan-connection-url"
                  readOnly
                  type="text"
                  value={connectionUrl}
                />
              </div>

              <div className={styles.lanQrWarning}>
                Only share this QR code or connection link with devices you
                trust. After pairing, bookmark the Browser URL for daily access.
              </div>

              {copyError ? (
                <p className={styles.personaModalError}>{copyError}</p>
              ) : null}
            </div>
          </div>
    </ModalShell>
  );
}
