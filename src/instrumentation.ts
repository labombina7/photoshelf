export async function register() {
  // Only run in the Node.js runtime (not Edge), and only on the server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startWatcher } = await import('./lib/folderWatcher');
    startWatcher().catch(err => console.error('[watcher] Failed to start:', err));
  }
}
