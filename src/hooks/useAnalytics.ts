'use client';

import { track } from '@/lib/analytics';

export function useAnalytics() {
  return { track };
}
