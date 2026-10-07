export function formatMoney(amount: string | number, currency = "RON") {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function statusLabel(status: string) {
  return {
    pending: "Pending",
    confirmed: "Confirmed",
    declined: "Declined",
    active: "Active",
    completed: "Completed",
    cancelled: "Cancelled",
    delivered: "Delivered",
    read: "Read",
    failed: "Failed",
    high: "High",
    medium: "Medium",
    low: "Low",
    not_evaluated: "Not evaluated",
  }[status] ?? status;
}
