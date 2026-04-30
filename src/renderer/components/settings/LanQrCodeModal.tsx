import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toString as toQrSvg } from "qrcode";

import { Button } from "@/components/ui/button";

import styles from "./settings.module.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [svgMarkup, setSvgMarkup] = useState("");
  const [isCopying, setIsCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!portalRoot) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [portalRoot]);

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

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!portalRoot) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const getFocusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const initialTarget =
      panel.querySelector<HTMLElement>("[autofocus]") ?? getFocusable()[0] ?? panel;
    initialTarget.focus();

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === panel) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleTab);

    return () => {
      window.removeEventListener("keydown", handleTab);
      previousFocus?.focus();
    };
  }, [portalRoot]);

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

  if (!portalRoot) {
    return null;
  }

  return createPortal(
    <div
      className={styles.personaModalOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-label="LAN QR code"
        aria-modal="true"
        className={`${styles.personaModalPanel} ${styles.lanQrModalPanel}`}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className={styles.personaModalHeader}>
          <div className={styles.personaModalHeading}>
            <span className={styles.personaModalEyebrow}>LAN Access</span>
            <span className={styles.personaModalTitle}>Scan to connect</span>
          </div>
          <button
            className={styles.personaModalClose}
            onClick={onClose}
            type="button"
          >
            X
          </button>
        </div>

        <div className={styles.personaModalBody}>
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
                Only share this QR code with devices you trust on this network.
              </div>

              {copyError ? (
                <p className={styles.personaModalError}>{copyError}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.personaModalFooter}>
          <span className={styles.lanQrFooterNote}>
            The token stays in the URL fragment so it is not sent to the server.
          </span>
          <div className={styles.personaModalFooterRight}>
            <Button onClick={onClose} type="button" variant="outline">
              Close
            </Button>
            <Button
              autoFocus
              disabled={isCopying}
              onClick={() => void handleCopy()}
              type="button"
            >
              {isCopying ? "Copying..." : "Copy connection link"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    portalRoot
  );
}