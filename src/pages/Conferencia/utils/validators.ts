export function validateBarcode(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  const trimmed = code.trim();
  return trimmed.length >= 8 && trimmed.length <= 14;
}

export function formatProductName(name: string, maxLength: number = 50): string {
  if (!name) return "";
  return name.length > maxLength ? name.substring(0, maxLength) + "..." : name;
}

export function calculateDifference(scanned: number, system: number): number {
  return scanned - system;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
