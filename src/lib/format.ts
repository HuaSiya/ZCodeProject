const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function formatDateTime(timestamp: number): string {
  return dateTimeFormatter.format(new Date(timestamp));
}

export function formatDate(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp));
}

export function toDateTimeLocalValue(timestamp: number | null): string {
  if (timestamp === null) {
    return "";
  }
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

export function fromDateTimeLocalValue(value: string): number | null {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function formatPercent(percent: number): string {
  const fixed = percent.toFixed(1);
  return `${fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed}%`;
}
