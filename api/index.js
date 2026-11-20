let cachedApp = null;

export default async function handler(req, res) {
  try {
    if (!cachedApp) {
      const mod = await import('./_bundle.mjs');
      cachedApp = mod.default;
    }

    await new Promise((resolve, reject) => {
      res.once('finish', resolve);
      res.once('close', resolve);
      res.once('error', reject);
      cachedApp(req, res, (err) => {
        if (err) reject(err);
      });
    });
  } catch (err) {
    console.error('Vercel API boot/runtime error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'VERCEL_API_BOOT_ERROR',
          message: err?.message || String(err),
          code: err?.code || null,
        })
      );
    }
  }
}
