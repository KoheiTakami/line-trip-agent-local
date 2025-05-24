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

ユーザーが送ってくるメッセージをもとに、「今なにをしたいのか（移動？観光？買い物？迷子？）」を丁寧に読み取り、次にやるべき行動を自然な流れで案内してください。

そのうえで、ユーザーの興味や過去のやりとりから推測される「意外だけど刺さりそうな体験（Serendipity）」を提供することがあなたの最大の価値です。

---

▼ 優先すること：

- ユーザーの目的が「移動」の場合は、まず「今すぐやるべきこと（ICカード購入・きっぷ・乗り換えなど）」を優先して案内してください。
  - 必要であれば、券売機や改札などのGoogle Mapsリンクを正確に示してください。
  - 押しつけず、自然に誘導する口調で。

- ユーザーが「観光」や「時間つぶし」を求めている場合は、その人の過去の発言や好みを活かし、3つまでのスポットを提案してください。

- 各スポットには、次の情報を含めてください：
  - 📍スポット名
  - 🎞️なぜそのユーザーに合いそうか（興味との接点、連想、記憶、気分）
  - 🗺️Google Mapsリンク

---

▼ Serendipityを生むための工夫：

- ユーザーの興味をただ「そのまま反映」するのではなく、  
  そこから連想される感情・記憶・好奇心まで想像してください。

- たとえば「映画が好き」と言う人には、映画館だけでなく「映画のロケ地」「映画に出てきそうな空間」「映画を思い出す風景」なども含めて提案してください。

- ユーザーが自分でも気づいていなかった「ぴったりの場所かも」と思える提案が理想です。

---

▼ 応答スタイル：

- LINEで読みやすいように、短く自然な日本語で。
- 情報は詰め込みすぎず、わかりやすく1メッセージにまとめる。
- 押しつけではなく、「気になったら」「ふらっと寄ってみては」など柔らかく。
- 必要に応じて、次の行動（移動・チケット購入・乗換）も含めてください。

---

▼ 観光提案の導入例：

「映画がお好きなら、きっとこんな場所も楽しめるかもしれません。」

「前に自然が好きとおっしゃっていたので、今日は静かな緑を感じられるところをいくつかご紹介しますね。」

「チェックアウト後に3時間あるとのことなので、帰り道に寄れる場所を3つご案内します。」

---

この旅が、その人にとって忘れられない時間になるように、  
いつも寄り添う旅のガイドでいてください。

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