/* common.print.js - helper condivisi per PDF/stampa */

export const getJsPDFConstructor = (win = globalThis.window) => {
  const jspdfNs = win?.jspdf || {};
  return jspdfNs.jsPDF || win?.jsPDF || null;
};

export const sanitizePdfFileName = (value, fallback = 'documento') => {
  const clean = String(value || fallback)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim();
  return clean || fallback;
};

export const joinLocation = (entity = {}) => [
  entity.zip || '',
  entity.city || '',
  entity.province ? `(${entity.province})` : ''
].filter(Boolean).join(' ');

export const buildPartyLines = (entity = {}, fallbackName = '') => [
  entity.name || fallbackName,
  entity.address || '',
  joinLocation(entity)
].filter(Boolean);

export const splitCodeDescription = (description = '') => {
  const parts = String(description || '').split(' - ');
  const code = parts.length > 1 ? parts.shift() : '';
  const desc = parts.length ? parts.join(' - ') : String(description || '');
  return { code: code || '-', description: desc };
};

export const requireJsPDF = (jsPDFCtor = getJsPDFConstructor()) => {
  if (!jsPDFCtor) throw new Error('Libreria PDF non disponibile.');
  return jsPDFCtor;
};
