function validateEnvVars() {
  if (process.env.NODE_ENV === 'test') return;

  if (!process.env.SESSION_SECRET) {
    throw new Error(
      '[photoshelf] SESSION_SECRET environment variable must be set to a secure random string. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }
  if (!process.env.APP_PASSWORD) {
    throw new Error(
      '[photoshelf] APP_PASSWORD environment variable must be set.'
    );
  }
}

export async function register() {
  // Only run in the Node.js runtime (not Edge), and only on the server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    validateEnvVars();
    const { startWatcher } = await import('./lib/folderWatcher');
    startWatcher().catch(err => console.error('[watcher] Failed to start:', err));
  }
}
