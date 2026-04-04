/**
 * EAN-13 barcode utilities
 * Generates valid EAN-13 codes with correct check digit
 */

/**
 * Calculate EAN-13 check digit for a 12-digit string
 */
export function calculateEAN13CheckDigit(digits12: string): number {
  if (digits12.length !== 12 || !/^\d{12}$/.test(digits12)) {
    throw new Error("Input must be exactly 12 digits");
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Validate a full 13-digit EAN-13 code
 */
export function isValidEAN13(code: string): boolean {
  if (code.length !== 13 || !/^\d{13}$/.test(code)) return false;
  const checkDigit = calculateEAN13CheckDigit(code.slice(0, 12));
  return checkDigit === parseInt(code[12], 10);
}

/**
 * Generate a random valid EAN-13 code
 * Uses prefix 789 (Brazil GS1 country code)
 */
export function generateEAN13(): string {
  // 789 = Brazil GS1 prefix
  const prefix = "789";
  let code = prefix;

  // Generate 9 random digits
  for (let i = 0; i < 9; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }

  // Calculate and append check digit
  const checkDigit = calculateEAN13CheckDigit(code);
  return code + checkDigit.toString();
}
