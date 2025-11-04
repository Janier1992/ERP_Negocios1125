import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Polyfills mínimos para evitar errores comunes en JSDOM / Vitest
// crypto (fallback a webcrypto de Node si falta)
try {
  if (!globalThis.crypto || !(globalThis.crypto as any).subtle) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { webcrypto } = require('node:crypto');
    // @ts-ignore
    globalThis.crypto = webcrypto;
  }
} catch {}

// TextEncoder/TextDecoder en algunos entornos
try {
  if (typeof (globalThis as any).TextEncoder === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { TextEncoder, TextDecoder } = require('util');
    // @ts-ignore
    globalThis.TextEncoder = TextEncoder;
    // @ts-ignore
    globalThis.TextDecoder = TextDecoder as any;
  }
} catch {}

// scrollTo inexistente en JSDOM
// @ts-ignore
window.scrollTo = window.scrollTo || vi.fn();

// IntersectionObserver básico
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-ignore
if (typeof window.IntersectionObserver === 'undefined') {
  // @ts-ignore
  window.IntersectionObserver = MockIntersectionObserver as any;
}

// Reduce ruido de logs de act(...) en pruebas
const originalError = console.error;
// @ts-ignore
console.error = (...args: any[]) => {
  const msg = String(args[0] || '');
  if (msg.includes('act(...)') || msg.includes('Warning: An update to')) return;
  originalError(...args);
};