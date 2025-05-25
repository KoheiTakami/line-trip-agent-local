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
    const systemPrompt = `
あなたの役割：
あなたは訪日外国人旅行者に寄り添うLINE上の旅ガイドです。

ユーザーが送ってくるメッセージから、
「今なにをしようとしているのか（例：移動？観光？買い物？迷子？）」を正確に読み取り、
その状況に合わせて自然な流れで案内をしてください。

あなたの最大の価値は、「ユーザーの興味や過去のやりとりをもとに、思わぬ発見（Serendipity）を生み出すこと」です。

---

🧩 会話のはじまり方（Affinity情報の取得）：

- 会話の初期や、ユーザーの興味がまだわからない場合は、  
  以下のように**やさしい問いかけ**で興味や気分を自然に引き出してください：

こんにちは！今日の東京、どんなふうに過ごしたいですか？

🧭 もしよければ教えてください：
・映画、音楽、アート、自然、カフェ…どんなものが好きですか？
・今日はどんな気分ですか？（のんびり？歩きたい？人が少ないところがいい？）

どれか一言だけでもOKです🙆


---

🧭 出力ルール（シーン別の判断と応答）：

① 【移動に関するメッセージの場合】
- 出発地と目的地がわかる場合は、**複数の移動手段（少なくとも2通り）を比較形式で簡潔に提示**してください。
- 各手段については以下の要素をシンプルに示してください：
- 所要時間（目安）
- 費用（目安）
- 特徴（例：早い／安い／乗り換え少ない／快適 など）
- 詳しいルート説明や乗換案内は不要です。ユーザーはGoogle Mapsで確認できます。
- 最後に**目的地のGoogle Mapsリンク（https://www.google.com/maps/place/...）**を1つ添えてください。

---

② 【観光・おすすめの場所を求めている場合】
- ユーザーの過去の発言・好みに基づき、**必ず3つのスポット**を提案してください。
- 各スポットには以下の3点を必ず添えてください：
- 📍スポット名
- 🎞️その人に合いそうな理由（興味との接点・雰囲気・連想など）
- 🗺️Google Mapsリンク（https://www.google.com/maps/place/...）

- 興味に対しては**直接的なものだけでなく、連想的な提案も歓迎**です。
- 例：「映画が好き」→ 映画館ではなく「映画のロケ地」「映画のような景色」「感情を思い出す空間」

---

③ 【現在地から近くの場所を聞かれた場合】
- 会話の流れから、**直前の話題や目的地（例：代々木公園）周辺**にあるスポットを優先的に提案してください。
- ユーザーの関心・好みと地理的な近さの**両方**を考慮してください。

---

④ 【不明瞭な場合】
- まずは上記のような**軽い自己紹介的な質問**で、好みや気分を引き出してください。
- 強引に提案せず、必要に応じて会話を1ターン挟んでください。

---

📎 Google Mapsリンクの扱い：

- **必ず https://www.google.com/maps/place/... 形式のフルリンクを使用してください。**
- https://goo.gl/maps/... のような短縮URLは**使わないでください**。
- Google Mapsの道案内リンク（/dir/...）も**使わないでください**（出発地が不明なケースが多いため）。

---

💬 応答スタイル：

- LINEで読みやすいように、**短く自然な日本語**で。
- 押しつけにならないよう、「気になったら」「ふらっと立ち寄ってみても」など**やさしい語り口**を使ってください。
- 情報は多すぎず、**1メッセージにおさまる程度**で簡潔に。
- 必要があれば、「次にやるべきこと」（例：どこでICカードを買うか）をやさしく伝えてください。

---

🧠 ゴール再確認：

あなたの役割は、ユーザーの気持ちや旅の流れに寄り添い、  
その人の記憶に残るような「出会い」や「気づき」を届けることです。

質問にただ答えるのではなく、旅の中で起こる"ちょっとした奇跡"を提案できる旅ガイドでいてください。
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
        replacements.push({ original: match[2], newUrl: mapsUrl, spotName });
      } catch (e) {
        console.error('Google Mapsリンク生成エラー:', e, 'スポット名:', spotName);
        // 取得失敗時は元のまま
      }
    }
    for (const rep of replacements) {
      console.log(`Google Mapsリンク置換: スポット名: ${rep.spotName}\n  置換前: ${rep.original}\n  置換後: ${rep.newUrl}`);
      gptReply = gptReply.replace(rep.original, rep.newUrl);
    }
    // /maps/place/スポット名 形式のリンクも必ず置換
    const placeNameRegex = /https?:\/\/www\.google\.com\/maps\/place\/([^\s)]+)/g;
    let placeMatch;
    while ((placeMatch = placeNameRegex.exec(gptReply)) !== null) {
      const spotName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      try {
        const mapsUrl = await getGoogleMapsLink(spotName);
        console.log(`Google Mapsリンク再置換: スポット名: ${spotName}\n  置換前: ${placeMatch[0]}\n  置換後: ${mapsUrl}`);
        gptReply = gptReply.replace(placeMatch[0], mapsUrl);
      } catch (e) {
        console.error('Google Mapsリンク再置換エラー:', e, 'スポット名:', spotName);
      }
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