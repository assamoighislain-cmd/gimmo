export default function handler(_req, res) {
  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'API bundle not built yet. Run npm run build.' }));
}
