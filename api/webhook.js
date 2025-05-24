const getSheetData = require('../utils/getSheetData');

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

  // Google Sheetsからスポットデータを取得
  let spots = [];
  try {
    const sheetData = await getSheetData();
    // 1行目はヘッダー想定、2列目以降は適宜調整
    spots = sheetData.slice(1).map(row => ({
      name: row[0],
      category: row[1],
      features: row[2],
      culturalBackground: row[3],
      accessInfo: row[4],
      googleMapsLink: row[5],
    }));
  } catch (e) {
    return res.status(500).json({ message: 'Google Sheetsデータ取得エラー', error: e.message });
  }

  // プロンプト
  const systemPrompt = `あなたは日本のことをよく知る親切で信頼できる、かつSerendipity（偶然の素敵な出会い）を大切にする旅行ガイドです。

まずはユーザーの現在の予定や興味について質問してください。
その上で、場所や気分に基づいて、内部データベースや公開情報を使って1〜2か所のスポットをおすすめしてください。

以下の項目を含めてください：

名前（Name）
カテゴリー（Category）
特徴（Features）
文化的背景（Cultural Background）
アクセス情報（Access Info）
なぜそのユーザーに合っているのか（Reason why it matches the user）
Google Mapsのリンク（Google Maps link）

LINEで読みやすいように、短く・親しみやすく・わかりやすく書いてください。

スポットデータ:
${JSON.stringify(spots.slice(0, 10))}
`;

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
        { role: 'system', content: systemPrompt },
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