process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const getSheetData = require('./getSheetData');
const getGoogleMapsLink = require('../utils/getGoogleMapsLink');

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method Not Allowed' });
      image.png }

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
        accessInfo: row[4]
        // location_url（row[5]）は除外
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
  - 路線案内は**実際の鉄道路線に基づいて正確に**行い、存在しない乗り換えや路線を案内しないようにしてください。
    - 例：新宿駅から新宿御苑前駅へは「東京メトロ丸ノ内線」で1駅です。
  - 必要に応じて、券売機や改札などの場所を明記し、Google Mapsリンクを添えてください。
  - 押しつけず、自然に誘導する口調で。

---

▼ Google Mapsリンクの扱いについて：

- Google Mapsのリンクは、**目的地の正確な場所がわかるフルリンク**（https://www.google.com/maps/place/...）を使用してください。
- https://goo.gl/maps/... のような**短縮URLは使わない**でください。
- 出発地が不明なことも多いため、Google Mapsの道案内リンク（/dir/...）は基本的に使わないでください。
- ユーザーがリンクをタップして、自分で現在地からの経路を確認できるようにしましょう。

---

▼ 観光提案をする場合は：

- ユーザーの過去の発言からわかっている「興味（例：映画が好き、静かな場所が好き）」と**接点がある理由を明示**してください。
- 提案は**最大3つまで**に絞り、ユーザーが**選べるように**してください。
- 最初に「おっしゃっていたように〜がお好きなら…」などの導入をつけてください。
- 各提案には以下の3点を含めてください：
  - 📍スポット名
  - 🎞️なぜそのユーザーに合うのか（興味との接点、連想、記憶、気分など）
  - 🗺️Google Mapsリンク（https://www.google.com/maps/place/...）

- たとえば「映画が好き」と言う人には、映画館だけでなく「映画のロケ地」「映画に出てきそうな空間」「映画を思い出す風景」なども提案してください。

---

▼ 応答スタイル：

- LINEで読みやすいように、**短く自然な日本語**で書いてください。
- 情報は詰め込みすぎず、1つのメッセージでわかりやすく。
- 押しつけにならないよう、「気になったら」「ふらっと立ち寄れたら」など**柔らかい表現**を心がけてください。
- 必要に応じて、次にとるべき行動（きっぷ購入・乗り換えなど）を明確に案内してください。

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
    let gptReply = openaiData.choices?.[0]?.message?.content || 'エラーが発生しました';

    // ChatGPTの返答からスポット名を抽出し、Google Mapsリンクを正確なものに置換
    // 例: 📍スポット名\n...\n🗺️ ...
    const spotRegex = /📍(.+?)\n[\s\S]*?🗺️ ?(https?:\/\/[^\s]+)/g;
    let match;
    const replacements = [];
    while ((match = spotRegex.exec(gptReply)) !== null) {
      const spotName = match[1].trim();
      try {
        const mapsUrl = await getGoogleMapsLink(spotName);
        replacements.push({ original: match[2], newUrl: mapsUrl });
      } catch (e) {
        console.error('Google Mapsリンク生成エラー:', e, 'スポット名:', spotName);
        // 取得失敗時は元のまま
      }
    }
    for (const rep of replacements) {
      gptReply = gptReply.replace(rep.original, rep.newUrl);
    }

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