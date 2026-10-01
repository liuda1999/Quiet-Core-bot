// Matrix tests cover device health plugin behavior.
import { describe, expect, it } from "vitest";
import { isQuietCoreManagedMatrixDevice, summarizeMatrixDeviceHealth } from "./device-health.js";

describe("matrix device health", () => {
  it("detects QuietCore-managed device names", () => {
    expect(isQuietCoreManagedMatrixDevice("QuietCore Gateway")).toBe(true);
    expect(isQuietCoreManagedMatrixDevice("QuietCore Debug")).toBe(true);
    expect(isQuietCoreManagedMatrixDevice("Element iPhone")).toBe(false);
    expect(isQuietCoreManagedMatrixDevice(null)).toBe(false);
  });

  it("summarizes stale QuietCore-managed devices separately from the current device", () => {
    const summary = summarizeMatrixDeviceHealth([
      {
        deviceId: "du314Zpw3A",
        displayName: "QuietCore Gateway",
        current: true,
      },
      {
        deviceId: "BritdXC6iL",
        displayName: "QuietCore Gateway",
        current: false,
      },
      {
        deviceId: "G6NJU9cTgs",
        displayName: "QuietCore Debug",
        current: false,
      },
      {
        deviceId: "phone123",
        displayName: "Element iPhone",
        current: false,
      },
    ]);

    expect(summary).toEqual({
      currentDeviceId: "du314Zpw3A",
      currentQuietCoreDevices: [
        {
          deviceId: "du314Zpw3A",
          displayName: "QuietCore Gateway",
          current: true,
        },
      ],
      staleQuietCoreDevices: [
        {
          deviceId: "BritdXC6iL",
          displayName: "QuietCore Gateway",
          current: false,
        },
        {
          deviceId: "G6NJU9cTgs",
          displayName: "QuietCore Debug",
          current: false,
        },
      ],
    });
  });
});
