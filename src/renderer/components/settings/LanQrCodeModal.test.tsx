// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanQrCodeModal } from "./LanQrCodeModal";

const qrCodeMocks = vi.hoisted(() => ({
  toString: vi.fn(),
}));

vi.mock("qrcode", () => ({
  toString: qrCodeMocks.toString,
}));

describe("LanQrCodeModal", () => {
  beforeEach(() => {
    qrCodeMocks.toString.mockReset();
    qrCodeMocks.toString.mockResolvedValue(
      '<svg data-testid="qr-svg" viewBox="0 0 10 10"></svg>'
    );
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function renderModal(onClose = vi.fn(), onCopied = vi.fn()) {
    render(
      <LanQrCodeModal
        apiUrl="http://192.168.1.25:3001"
        browserUrl="http://192.168.1.25:4173"
        connectionUrl="http://192.168.1.25:4173/#/connect?api=http%3A%2F%2F192.168.1.25%3A3001&token=machine-token"
        onClose={onClose}
        onCopied={onCopied}
      />
    );

    return { onClose, onCopied };
  }

  it("renders the QR modal and connection details", async () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: /lan qr code/i })).toBeTruthy();
    expect(screen.getByDisplayValue(/machine-token/i)).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId("qr-svg")).toBeTruthy();
    });
  });

  it("copies the connection link", async () => {
    const { onCopied } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: /copy connection link/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "http://192.168.1.25:4173/#/connect?api=http%3A%2F%2F192.168.1.25%3A3001&token=machine-token"
      );
    });
    expect(onCopied).toHaveBeenCalled();
  });

  it("closes from the close button", () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it("closes on escape", () => {
    const { onClose } = renderModal();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("closes on overlay click", () => {
    const { onClose } = renderModal();

    fireEvent.mouseDown(screen.getByRole("dialog", { name: /lan qr code/i }).parentElement!);

    expect(onClose).toHaveBeenCalled();
  });

  it("shows the trust warning", () => {
    renderModal();

    expect(
      screen.getByText(/only share this qr code with devices you trust/i)
    ).toBeTruthy();
  });
});