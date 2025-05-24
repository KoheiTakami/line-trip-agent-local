export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const event = req.body.events?.[0];
  const replyToken = event?.replyToken;
  const userMessage = event?.message?.text;

  if (!replyToken || !userMessage) {
    return res.status(200).json({ message: 'No replyToken or userMessage', body: req.body });
  }

  const lineAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const lineReplyEndpoint = 'https://api.line.me/v2/bot/message/reply';

  const fetchRes = await fetch(lineReplyEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${lineAccessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text: `あなたのメッセージ: ${userMessage}` }],
    }),
  });

  const fetchResText = await fetchRes.text();
  console.log('LINE返信APIレスポンス:', fetchRes.status, fetchResText);

  if (!fetchRes.ok) {
    return res.status(500).json({ error: 'LINE返信APIでエラー', details: fetchResText });
  }

  return res.status(200).json({ message: 'Replied to LINE', lineResponse: fetchResText });
}