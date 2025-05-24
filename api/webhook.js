export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ step: 'method check', message: 'Method Not Allowed' });
  }
  // import文なしで、リクエストボディだけ返す
  return res.status(200).json({ step: 'debug', body: req.body });
} 