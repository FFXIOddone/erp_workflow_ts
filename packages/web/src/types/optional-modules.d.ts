/**
 * Type declarations for optional dynamic import modules
 * These packages are optional and may not be installed
 * 
 * Note: Using 'any' for optional dynamic imports that may not be installed.
 * When these packages are installed, their own types will be used.
 */

// These are ambient module declarations for packages that may or may not be installed.
// TypeScript will use these types when the packages aren't available.

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module 'xlsx' {
  const XLSX: any;
  export = XLSX;
}

declare module 'jspdf' {
  const jsPDF: any;
  export = jsPDF;
  export default jsPDF;
}

declare module 'jspdf-autotable' {
  const autoTable: any;
  export = autoTable;
  export default autoTable;
}
