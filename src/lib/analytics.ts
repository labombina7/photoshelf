import * as amplitude from '@amplitude/analytics-browser';

let initialized = false;

export function initAnalytics() {
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey || initialized) return;
  initialized = true;

  if (process.env.NODE_ENV === 'development') return;

  amplitude.init(apiKey, { defaultTracking: false, autocapture: false });
}

export function track(event: string, props?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Amplitude]', event, props);
    return;
  }
  if (!process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY) return;
  amplitude.track(event, props);
}
