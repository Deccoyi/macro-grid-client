import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectScreen } from "./ConnectScreen";

const base = () => ({
  host: "192.168.1.5:9820", status: "pairing_required" as const, onHostChange: vi.fn(), onConnect: vi.fn(), onSubmitPin: vi.fn(),
  onScanQr: vi.fn(), servers: [], onPickServer: vi.fn(),
});

describe("ConnectScreen on the PIN prompt", () => {
  afterEach(cleanup);
  it("offers the QR scan next to the PIN field", () => {
    const props = base();
    render(<ConnectScreen {...props} />);
    fireEvent.click(screen.getByText("Scan QR"));
    expect(props.onScanQr).toHaveBeenCalled();
  });

  it("lets the person go back to the host entry, and returns to the PIN prompt on a new pairing request", () => {
    const props = base();
    const { rerender } = render(<ConnectScreen {...props} />);
    fireEvent.click(screen.getByText("Use another server"));
    expect(screen.getByPlaceholderText("192.168.1.20")).toBeTruthy();

    rerender(<ConnectScreen {...props} status="connecting" />);
    rerender(<ConnectScreen {...props} status="pairing_required" />);
    expect(screen.getByPlaceholderText("000000")).toBeTruthy();
  });
});
