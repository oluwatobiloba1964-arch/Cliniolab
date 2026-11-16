// src/lib/sheetjs.ts
/**
 * Lazy SheetJS loader. The `xlsx` package is ~400 KB minified; importing it
 * statically at the top of every bulk-upload page ships it to every visitor
 * of those pages even before a file is selected. All actual usage happens
 * inside event handlers (file picked / template downloaded), so the module
 * is only fetched on first use and cached for subsequent calls.
 */

type XLSXModule = typeof import('xlsx');

let cached: Promise<XLSXModule> | null = null;

/** Returns the SheetJS module, importing it on first call. */
export function loadSheetJS(): Promise<XLSXModule> {
  if (!cached) {
    cached = import('xlsx').catch((err) => {
      // Don't cache a failed import — allow a retry on the next interaction.
      cached = null;
      throw err;
    });
  }
  return cached;
}
