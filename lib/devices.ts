export type DeviceOption = {
  id: string;
  label: string;
};

const DEFAULT_DEVICE_IDS = ["TEAM_GPS_01", "TEAM_GPS_02"];

function toLabel(deviceId: string): string {
  const parts = deviceId.split("_");
  const suffix = parts[parts.length - 1];
  if (/^\d+$/.test(suffix)) {
    return `Bus ${suffix}`;
  }
  return deviceId;
}

export function getConfiguredDevices(): DeviceOption[] {
  const raw = process.env.NEXT_PUBLIC_DEVICE_IDS;
  const ids = (raw ? raw.split(",") : DEFAULT_DEVICE_IDS)
    .map((value) => value.trim())
    .filter(Boolean);

  return ids.map((id) => ({
    id,
    label: toLabel(id),
  }));
}

export function getDefaultDeviceId(): string {
  return getConfiguredDevices()[0]?.id ?? "TEAM_GPS_01";
}
