import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utilitário para combinar classes CSS do Tailwind de forma condicional e limpa.
 * Utiliza 'clsx' para lógica e 'twMerge' para resolver conflitos de classes.
 * 
 * @param inputs - Array de valores de classes (strings, objetos, condicionais).
 * @returns {string} String de classes otimizada.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
