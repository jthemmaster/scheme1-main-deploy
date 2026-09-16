export const FREE_SCHEMES_PER_MONTH = 2;

export const EXPORT_KIND = {
  preview: "layout-png",
  cdxml: "cdxml",
  hires: "hires-png",
};

export function monthKey(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function isValuableExport(kind) {
  return kind === EXPORT_KIND.cdxml || kind === EXPORT_KIND.hires;
}

export function decideExport({ kind, usedThisMonth, credits }) {
  const used = Number(usedThisMonth) || 0;
  const creditBalance = Number(credits) || 0;
  if (!isValuableExport(kind)) {
    return { allowed: true, reason: "preview", consume: 0 };
  }
  if (used < FREE_SCHEMES_PER_MONTH) {
    return { allowed: true, reason: "free-allowance", consume: 1 };
  }
  if (creditBalance > 0) {
    return { allowed: true, reason: "credit", consume: 1 };
  }
  return { allowed: false, reason: "needs-credits", consume: 0 };
}

export function remainingFree(usedThisMonth) {
  return Math.max(0, FREE_SCHEMES_PER_MONTH - (Number(usedThisMonth) || 0));
}

export function purchaseCredits() {
  throw new Error("Credits checkout is not wired.");
}

export function createUsageLedger(storage) {
  const usedKey = () => `scheme1.valuable.${monthKey()}`;
  return {
    usedThisMonth() {
      const raw = Number(storage.getItem(usedKey()) || "0");
      return Number.isFinite(raw) && raw > 0 ? raw : 0;
    },
    credits() {
      const raw = Number(storage.getItem("scheme1.credits") || "0");
      return Number.isFinite(raw) && raw > 0 ? raw : 0;
    },
    record(kind) {
      if (!isValuableExport(kind)) return this.usedThisMonth();
      const next = this.usedThisMonth() + 1;
      storage.setItem(usedKey(), String(next));
      return next;
    },
  };
}
