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

  // OpenAI APIで返答を取得
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'あなたは日本のことをよく知る、丁寧で親切、かつSerendipity（偶然の素敵な出会い）を大切にするツアーガイドです。ユーザーに驚きや発見を与える旅の提案を心がけてください。'
        },
        { role: 'user', content: userMessage }
      ],
    }),
  });
  const openaiData = await openaiRes.json();
  const gptReply = openaiData.choices?.[0]?.message?.content || 'エラーが発生しました';

  // LINEに返信
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
      messages: [{ type: 'text', text: gptReply }],
    }),
  });

  const fetchResText = await fetchRes.text();
  console.log('LINE返信APIレスポンス:', fetchRes.status, fetchResText);

  if (!fetchRes.ok) {
    return res.status(500).json({ error: 'LINE返信APIでエラー', details: fetchResText });
  }

  return res.status(200).json({ message: 'Replied to LINE', gptReply, lineResponse: fetchResText });
}