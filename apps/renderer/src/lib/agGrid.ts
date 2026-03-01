import {
  ClientSideRowModelModule,
  CsvExportModule,
  DateFilterModule,
  ModuleRegistry,
  NumberFilterModule,
  TextFilterModule
} from "ag-grid-community";

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  CsvExportModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule
]);

export function isAgGridAvailable(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    return false;
  }
  return typeof (window as Window & { ResizeObserver?: unknown }).ResizeObserver === "function";
}
