export type RestoreSummary = {
  restoredAt: string;
  sourceLastMutationAt: string;
  schemaVersion: number;
};

export function formatRestoreBanner(summary: RestoreSummary): string {
  return `Data current as of ${summary.sourceLastMutationAt} (restored ${summary.restoredAt})`;
}
