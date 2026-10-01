// Matrix plugin module implements device health behavior.
export type MatrixManagedDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  current: boolean;
};

export type MatrixDeviceHealthSummary = {
  currentDeviceId: string | null;
  staleQuietCoreDevices: MatrixManagedDeviceInfo[];
  currentQuietCoreDevices: MatrixManagedDeviceInfo[];
};

const QUIET_CORE_DEVICE_NAME_PREFIX = "QuietCore ";

export function isQuietCoreManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(QUIET_CORE_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const openClawDevices = devices.filter((device) =>
    isQuietCoreManagedMatrixDevice(device.displayName),
  );
  return {
    currentDeviceId,
    staleQuietCoreDevices: openClawDevices.filter((device) => !device.current),
    currentQuietCoreDevices: openClawDevices.filter((device) => device.current),
  };
}
