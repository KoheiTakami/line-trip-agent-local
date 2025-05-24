export default function handler(req, res) {
  if (req.method === 'POST') {
    // ここでリクエストボディを処理
    res.status(200).json({ message: 'Webhook received!' });
  } else {
    res.status(405).json({ message: 'Method Not Allowed' });
  }
} 