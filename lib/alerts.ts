export interface Alert {
  type: 'info' | 'warn';
  text: string;
}

// TODO: Replace stub with real MTA Service Status API
// MTA alerts endpoint: https://api.mta.info/#/subwayRealTimeFeeds
export async function getAlerts(): Promise<Alert[]> {
  return [
    { type: 'info', text: 'Harlem Line: Regular scheduled service' },
    { type: 'info', text: '6 Train: No reported delays' },
    { type: 'warn', text: 'Check MTA.info for service advisories' },
  ];
}
