export const formatNumber = (value: number, digits = 1) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value)

export const formatEnergy = (wattHours: number) =>
  wattHours >= 1000
    ? `${formatNumber(wattHours / 1000, 2)} kWh`
    : `${formatNumber(wattHours, 0)} Wh`

export const formatDuration = (seconds: number) => `${formatNumber(seconds / 3600, 2)} h`

export const formatDistance = (meters: number) => `${formatNumber(meters / 1000, 1)} km`

export const formatCycle = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(new Date(value)) + ' UTC'
