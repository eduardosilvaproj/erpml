import "@testing-library/jest-dom";
import { vi } from "vitest";

const canvasContextMock = {
  clearRect: vi.fn(),
  fill: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fillStyle: "",
  strokeStyle: "",
};

// Mock resize observer
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock canvas APIs used by animated backgrounds in page components
HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(() => ({
  ...canvasContextMock,
  transferFromImageBitmap: vi.fn(),
} as any));

// Prevent animation loops from running during tests
window.requestAnimationFrame = vi.fn(() => 1);
window.cancelAnimationFrame = vi.fn();
