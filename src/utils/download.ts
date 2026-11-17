import type jsPDF from 'jspdf';

type NativeWindow = { ReactNativeWebView?: { postMessage: (msg: string) => void } };
const nativeBridge = () => (typeof window !== 'undefined' ? (window as unknown as NativeWindow).ReactNativeWebView : undefined);

/** Dentro do app mobile (WebView) o download é delegado ao nativo; no navegador usa o save do jsPDF. */
export const savePdf = (doc: jsPDF, filename: string) => {
  const bridge = nativeBridge();
  if (bridge) bridge.postMessage(JSON.stringify({ type: 'DOWNLOAD_PDF', filename, base64: doc.output('datauristring') }));
  else doc.save(filename);
};

/** Coletor da marcação no AFD: "01" aplicativo mobile, "02" navegador. */
export const collectorCode = () => (nativeBridge() ? '01' : '02');

export const saveBytes = (bytes: Uint8Array, filename: string, type = 'text/plain') => {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
