import { useEffect, useRef, useCallback } from 'react';

interface BarcodeScanOptions {
  /**
   * Called when a complete scan is detected.
   * The raw barcode string is passed (without the trailing Enter).
   */
  onScan: (barcode: string) => void;
  /**
   * Minimum character count to treat a sequence as a scan (not manual typing).
   * Defaults to 4.
   */
  minLength?: number;
  /**
   * Max milliseconds between consecutive characters to be counted as part of
   * one scan. USB scanners typically deliver all chars within 50ms.
   * Defaults to 100.
   */
  maxInterCharMs?: number;
  /**
   * Whether the listener is active. Set to false to pause scanning.
   * Defaults to true.
   */
  enabled?: boolean;
}

/**
 * Detects USB barcode scanner input by watching for rapid keypress sequences
 * ending with Enter. Scanners act as HID keyboard devices and type the full
 * barcode string in one burst, which is distinguishable from normal typing.
 */
export function useBarcodeScan({
  onScan,
  minLength = 4,
  maxInterCharMs = 100,
  enabled = true,
}: BarcodeScanOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  // Keep ref current without re-attaching the listener
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;

      // If too much time has passed since the last key, reset the buffer
      if (gap > maxInterCharMs && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const scanned = bufferRef.current;
        bufferRef.current = '';

        if (scanned.length >= minLength) {
          onScanRef.current(scanned);
        }
        return;
      }

      // Only accumulate printable single characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    },
    [enabled, maxInterCharMs, minLength]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
