process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const getSheetData = require('./getSheetData');

export default async function handler(req, res) {
  try {
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
    const systemPrompt = `あなたは訪日旅行者のLINE上の旅ガイドです。

目的は、旅行者にとって「偶然の出会い（Serendipity）」となるような場所を紹介することです。  
ユーザーの好みや今日の予定を元に、「知らなかったけど、自分に合っていそう」と思える体験を届けてください。

▼ 応答ルール：
- まず「今日の予定があるか」ユーザーに聞いてください。
- 予定がある場合：
  - その目的地の近くで、ユーザーの興味と接点のある意外なスポットを1つだけ提案してください。
- 予定がない場合：
  - ユーザーの趣味・気分に基づいて1つの場所をおすすめしてください。

▼ 応答フォーマット：
- 軽やかで自然な日本語、LINEで読みやすいように。
- 提案は以下3つだけに絞ること：
  - スポット名（📍）
  - ひとことの理由（🎞️ 映画好きな方にぴったり…など）
  - Google Mapsのリンク（🗺️）
- 情報量は多すぎず、「ふらっと寄ってみたくなる」くらいがちょうどよいです。
- 英語や専門用語は使わず、シンプルで親しみやすく。

▼ 例：
ユーザーが「今日は渋谷に行く予定」と言った場合：

渋谷に行かれるんですね！  
そのあたりで、映画好きな方にちょっと刺さりそうな場所をご紹介します。

📍 Bunkamura  
🎞️ 東京の静かな文化に触れられる複合施設です。映画や美術館もあります。  
🗺️ https://www.google.com/maps/...

楽しんできてくださいね！

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
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}