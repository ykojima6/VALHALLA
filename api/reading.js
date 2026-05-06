// Vercel Serverless Function — POST /api/reading
// Body: { birthDate: "YYYY-MM-DD", cardId: number, reversed: boolean }
// Returns: { reading: string, card: {id, jp, name}, reversed: boolean }
//
// 内部で旧暦変換 → 二十七宿 → タロット解釈 を組み合わせ、OpenRouter
// (無料モデル) で「一つの占い結果」として日本語で返す。
// 出力には "宿曜" "タロット" などの内部用語は載せない。

const tarotData = [
  ["The Fool",          "愚者",     "気まぐれで不安定。目的がぼやけやすく、ふらっと動きたくなる。",            "間違いに気づき、目的を持って動き直す。甘い誘いには注意する。"],
  ["The Magician",      "奇術師",   "独創力とチャンス。技術や言葉を使って、新しい芽を出す。",                   "口先だけになりやすい。未熟さやミスを整え、足元を見直す。"],
  ["The High Priestess","女教皇",   "知識、気品、理性。ロマンチックでも一歩ずつ考えて進む。",                   "考えが浅くなりやすい。反発や気まぐれで物事を散らかさない。"],
  ["The Empress",       "女帝",     "安定、豊かさ、幸せ。実りが育ち、愛情や魅力が広がる。",                     "不安定さや嫉妬。ぜいたく、甘え、ライバル意識に注意する。"],
  ["The Emperor",       "皇帝",     "力、支配、行動力。目的を実現し、現実を動かす強さがある。",                 "無気力や見かけ倒し。強く出すぎると信用を失いやすい。"],
  ["The Hierophant",    "教皇",     "慈悲、寛容、安心感。良き相談相手や心の転換が助けになる。",                 "思いやり不足や反発。形だけの正しさや物質へのこだわりに注意する。"],
  ["The Lovers",        "恋人",     "恋愛、誘惑、楽しさ。心が動き、遊びやときめきが強くなる。",                 "気まぐれ、嫉妬、別れ。浮ついた態度や方針変更に注意する。"],
  ["The Chariot",       "戦車",     "勝利、成功、決断。強い意志で状況をコントロールする。",                     "敗北や妨害。勢いが乱れると、けんかや挫折につながりやすい。"],
  ["Strength",          "剛毅",     "勇気、情熱、元気。困難を突破し、努力で欲しいものを得る。",                 "自信のなさや無気力。押し切られず、力の使い方を整える。"],
  ["The Hermit",        "隠者",     "思慮分別とアドバイス。すぐ動かず、学びや研究から答えを探す。",             "軽率さや未熟さ。よい助言が得にくく、プレッシャーに負けやすい。"],
  ["Wheel of Fortune",  "運命の輪", "チャンス、発展、幸運。事態が好転し、運命的な流れが来る。",                 "不運や伸び悩み。悪い方へ考えすぎず、タイミングを待つ。"],
  ["Justice",           "正義",     "誠実、中立、公正。無理をせず、正しい判断で克服する。",                     "不公平、偏見、独断。バランスを崩さず、ずるさを避ける。"],
  ["The Hanged Man",    "刑死者",   "苦しい時期、身動きの取りにくさ。忍耐と自己犠牲が問われる。",               "見通しは出るが油断は禁物。わがままを直し、軌道修正する。"],
  ["Death",             "死神",     "損失、破局、見切り。終わらせるべきものをはっきりさせる。",                 "希望が戻る。一時的な失敗から立て直し、思わぬ回復がある。"],
  ["Temperance",        "節制",     "忍耐、反省、調和。心を素直にして、力を蓄える。",                           "対立、不一致、浪費。強情やプライドをゆるめる。"],
  ["The Devil",         "悪魔",     "悪い誘惑や転落。理性を失いやすく、困難な事態に注意する。",                 "目が覚めて自立する。誘惑に勝ち、まじめに立て直す。"],
  ["The Tower",         "塔",       "破壊、失敗、急なトラブル。古い考えやおごりが崩れる。",                     "小さく済む危険。誤解、うわさ、だまされやすさを早めに見抜く。"],
  ["The Star",          "星",       "希望、順調、よい未来。よい愛やチャンスが訪れる。",                         "悲観、あきらめ、疲れ。計画が流れても希望を捨てない。"],
  ["The Moon",          "月",       "不安定、あざむき、見えない敵。裏側や危険に気づくサイン。",                 "ウソを見抜く。小さな危険で済み、決心と安心が戻る。"],
  ["The Sun",           "太陽",     "幸福、成功、満足。目的を成し遂げ、明るい発展がある。",                     "孤独やむなしさ。望み通りでなくても人間関係を整える。"],
  ["Judgement",         "審判",     "再生、再起、目覚め。発想を変えると愛や流れがよみがえる。",                 "未決定、延期、こだわり。古い考えを変えないと進みにくい。"],
  ["The World",         "世界",     "成功、完成、幸運。目的を遂げ、すばらしい関係や成果に近づく。",             "挫折や不満足。中途半端で終わらせず、未練を整理する。"],
].map(([name, jp, upright, reversed], id) => ({ id, name, jp, upright, reversed }));

const SHUKU_ORDER = ["昴","畢","觜","参","井","鬼","柳","星","張","翼","軫","角","亢","氐","房","心","尾","箕","斗","女","虚","危","室","壁","奎","婁","胃"];
const SHUKU_DETAILS = {
  昴: ["プライドビューティー","格","価値あるものを見抜く","プライドで助けを拒まない"],
  畢: ["マイペース職人","安定","着実に守り育てる","変化を嫌いすぎない"],
  觜: ["言語化マスター","言葉","状況を言語化する","批評が冷たく響かないように"],
  参: ["ムードメーカー","行動","場を動かす明るさ","飽きやすさを予定で補う"],
  井: ["知性シェアタイプ","泉","知識を人の役に立てる","理屈で感情を覆わない"],
  鬼: ["ピュアひらめきタイプ","無垢","純粋な発想で突破する","警戒心の薄さに注意"],
  柳: ["ドラマチック情熱タイプ","熱","強い想いを伝える","気分に飲まれすぎない"],
  星: ["ステージスター","舞台","自分の色で人を惹きつける","目立つことへの恐れを手放す"],
  張: ["華やかプロデューサー","拡張","物事を大きく見せる力","見栄で負担を増やさない"],
  翼: ["自由トラベラー","飛翔","遠くを見る広い視点","理想の場所を探し続けない"],
  軫: ["癒やしチューナー","癒やし","人の痛みに寄り添う","背負いすぎて消耗しない"],
  角: ["ご縁クリエイター","成長","新しい縁を育てる力","勢いだけで約束を増やしすぎない"],
  亢: ["芯つよエレガンス","品格","筋を通して信頼を得る","正しさで相手を追い詰めない"],
  氐: ["安心ベースタイプ","根","人を安心させる持久力","身内意識が強くなりすぎる"],
  房: ["愛されオーラ","魅力","場の空気を豊かにする","甘えと依存の境目を見る"],
  心: ["本音センサー","感情","人の本音に触れる直感","感情の波で判断しない"],
  尾: ["ストイック完璧主義","集中","粘り強く成果へ寄せる","細部にこだわり孤立しない"],
  箕: ["風まかせ突破タイプ","風","停滞を動かす軽やかさ","言葉が鋭くなりすぎる"],
  斗: ["理想を叶えるリーダー","器","大きな構想を形にする","理想論で現実を置き去りにしない"],
  女: ["きちんと整えタイプ","整え","乱れを整える実務力","心配を抱え込みすぎない"],
  虚: ["ミステリアス夢見タイプ","夢","見えない流れを読む","現実逃避に傾かない"],
  危: ["繊細アラートタイプ","変化","危機を察知して進路を変える","不安だけで関係を切らない"],
  室: ["居場所クリエイター","構築","居場所を作る求心力","守りに入りすぎない"],
  壁: ["知識ストックタイプ","知恵","知識を蓄え人を支える","距離を取りすぎない"],
  奎: ["センス文章タイプ","美意識","言葉や形で魅せる","理想の高さで疲れない"],
  婁: ["気配りバランサー","世話","相手に合わせる柔軟性","自分の希望を後回しにしない"],
  胃: ["欲しいを掴むタイプ","獲得","必要なものを取りに行く","強引さや執着に注意"],
};
const MONTH_START_SHUKU = {1:"室",2:"奎",3:"胃",4:"畢",5:"参",6:"鬼",7:"張",8:"角",9:"氐",10:"心",11:"斗",12:"虚"};

// 1900-2099 lunar metadata (matches Python lunardate)
const LUNAR_INFO = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
  0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
  0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
  0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
  0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
  0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
  0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
  0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
  0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
  0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
  0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
  0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
  0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
  0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
  0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
  0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
  0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
  0x0d520
];
const _lLeapMonth = (y) => LUNAR_INFO[y - 1900] & 0xf;
const _lLeapDays  = (y) => _lLeapMonth(y) ? ((LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29) : 0;
const _lMonthDays = (y, m) => (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29;
function _lYearDays(y) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
  return sum + _lLeapDays(y);
}
function solarToLunar(y, m, d) {
  const objDate = Date.UTC(y, m - 1, d);
  const baseDate = Date.UTC(1900, 0, 31);
  let offset = Math.floor((objDate - baseDate) / 86400000);
  if (offset < 0 || y < 1900 || y > 2099) return { year: y, month: m, day: d };
  let i, temp = 0, lunarYear;
  for (i = 1900; i < 2100 && offset > 0; i++) { temp = _lYearDays(i); offset -= temp; }
  if (offset < 0) { offset += temp; i--; }
  lunarYear = i;
  const leap = _lLeapMonth(lunarYear);
  let isLeap = false;
  for (i = 1; i < 13 && offset >= 0; i++) {
    if (leap > 0 && i === leap + 1 && !isLeap) { --i; isLeap = true; temp = _lLeapDays(lunarYear); }
    else { temp = _lMonthDays(lunarYear, i); }
    if (isLeap && i === leap + 1) isLeap = false;
    if (offset < temp) break;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeap) isLeap = false; else { isLeap = true; --i; }
  }
  if (offset < 0) { offset += temp; --i; }
  return { year: lunarYear, month: i, day: offset + 1, isLeap };
}
function resolveShuku(y, m, d) {
  const lunar = solarToLunar(y, m, d);
  const startName = MONTH_START_SHUKU[lunar.month] || "室";
  const startIndex = SHUKU_ORDER.indexOf(startName);
  const idx = (startIndex + (lunar.day - 1)) % 27;
  const name = SHUKU_ORDER[idx];
  const [catchy, theme, strength, caution] = SHUKU_DETAILS[name];
  return { name, catchy, theme, strength, caution, lunar };
}

// ===== OpenRouter =====
// 上から順番に試す。:free モデルは時期により可用性が変わるため複数候補を並べる。
// 2026年初頭時点で OpenRouter で安定して見つかる無料モデルを優先。
const DEFAULT_MODEL_CHAIN = [
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];
const FORBIDDEN_TERMS = [
  "宿曜", "二十七宿", "二十八宿", "27宿",
  ...SHUKU_ORDER.map(n => `${n}宿`),
  "タロット", "大アルカナ", "アルカナ", "正位置", "逆位置",
];

function sanitize(text) {
  let out = String(text || "");
  for (const term of FORBIDDEN_TERMS) {
    out = out.split(term).join("");
  }
  // 連続改行や空行の整理
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

async function callOpenRouter({ birthDate, shuku, card, reversed }) {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) {
    console.error("[reading] OPENROUTER_API_KEY missing — falling back");
    return { text: null, error: { reason: "no_api_key" } };
  }

  const envModel = (process.env.OPENROUTER_MODEL || "").trim();
  const models = envModel ? [envModel] : DEFAULT_MODEL_CHAIN;
  console.log(`[reading] OpenRouter keyLen=${key.length} models=${JSON.stringify(models)}`);
  const today = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "long"
  }).format(new Date());
  const position = reversed ? "今は内側に向かう流れ" : "今は外に向かう流れ";
  const cardMeaning = reversed ? card.reversed : card.upright;

  const messages = [
    {
      role: "system",
      content: "あなたは日本語の占い師です。エンタメ占いとして温かく、具体的で、読者が今日すぐ動ける言葉で書いてください。医療・法律・投資・ギャンブルの保証や断定は避けます。出力は日本語のみ。"
    },
    {
      role: "user",
      content: `次の内部情報をもとに、生年月日と一枚のカードを統合した「今日のあなたへの占い」を、ひとつの自然な読み物として書いてください。
読み手には占いの技法名は伝えず、根拠を聞かれても「あなたの生まれ持った性質」「今日の流れ」「今のあなたへ届くサイン」のように自然な日本語で説明してください。

[生年月日] ${birthDate}
[今日] ${today}

[性格の傾向 / 内部参考。本文に名前として出さない]
タイプ呼称(本文に出してOK): 「${shuku.catchy}」
中心テーマ: 「${shuku.theme}」
強み: ${shuku.strength}
気をつけたいクセ: ${shuku.caution}

[今回引かれた1枚 / 内部参考。"カード" "正位置" "逆位置" などの語は本文に書かない]
${card.jp}（${card.name}）／${position}
意味: ${cardMeaning}

[出力要件]
- 日本語で 1500〜2000 字程度。一つの占い読み物として、章立てしすぎず自然な流れで書く。
- 見出しは最大3〜4個。各段落は短めで読みやすく。
- 序盤は「あなた自身の性質」を、相手が「これ自分のことだ」と感じる具体的な描写で書く。「${shuku.catchy}」というタイプ名は使ってよい。
- カードのメッセージは、技法名や"カード"という語を使わず、「今日のあなたへ届いているサイン」「今の流れ」「内側で起きている変化」のように溶け込ませる。
- 必ず触れる: ① 今日の気分・心の動き、② 仕事や日常での選び方、③ 人間関係・恋愛での距離感、④ 注意したいクセ、⑤ 今日すぐできる小さな行動を3つ。
- 最後に一言キーフレーズで締める。
- 禁止語(絶対に出さない): 宿曜、二十七宿、○○宿(昴宿/畢宿など)、タロット、大アルカナ、正位置、逆位置。
`
    }
  ];

  const errors = [];
  for (const model of models) {
    const result = await tryOneModel({ key, model, messages });
    if (result.text) {
      console.log(`[reading] OpenRouter ok model=${model} length=${result.text.length}`);
      return { text: result.text, error: null, modelUsed: model };
    }
    errors.push({ model, ...result.error });
    console.error(`[reading] model=${model} failed: ${JSON.stringify(result.error)}`);
  }
  return { text: null, error: { reason: "all_models_failed", attempts: errors } };
}

async function tryOneModel({ key, model, messages }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 22000);
  let res;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.PUBLIC_APP_URL || "https://valhalla-gilt.vercel.app",
        "X-Title": "Yggdrasill Tarot",
      },
      body: JSON.stringify({ model, messages, temperature: 0.85 }),
    });
  } catch (err) {
    clearTimeout(t);
    return { text: null, error: { reason: "fetch_threw", message: String(err && err.message) } };
  }
  clearTimeout(t);
  if (!res.ok) {
    let bodyText = "";
    try { bodyText = (await res.text()).slice(0, 600); } catch {}
    return { text: null, error: { reason: "non_ok", status: res.status, body: bodyText } };
  }
  let data;
  try { data = await res.json(); } catch (err) {
    return { text: null, error: { reason: "json_parse", message: String(err && err.message) } };
  }
  const raw = data?.choices?.[0]?.message?.content || "";
  const text = sanitize(raw);
  if (!text || text.length < 200) {
    return { text: null, error: { reason: "too_short", rawLen: raw.length, sanitizedLen: text.length, providerError: data?.error || null } };
  }
  return { text, error: null };
}

function localFallback({ shuku, card, reversed }) {
  const cardMeaning = reversed ? card.reversed : card.upright;
  const direction = reversed
    ? "今は外へ広げるよりも、内側を整える時"
    : "あなたの素のリズムに、今日の流れがまっすぐ味方している時";

  return `## 今のあなた

あなたには、もともと「${shuku.theme}」を中心に物事を選んでいく性質があります。${shuku.strength}ことが自然にできる人で、表面的に静かに見える瞬間も、内側にはかなりはっきりとした「これは大事にしたい」という基準があります。

人から強く言われて動くというより、自分の中で納得できた瞬間に集中力が一気に出るタイプです。周囲がまだ雰囲気で話している段階でも、あなたは細部の矛盾や、相手の本音、物事の弱い部分に先に気づいていることが多いはず。

## 今日の心の動き

${direction}が来ています。届いているサインの大筋は「${cardMeaning}」というニュアンス。むずかしく考えるより、いつもの選び方をほんの少しだけ変えてみる、くらいの軽さが合います。

人の期待に合わせすぎると、自分の本音が見えにくくなります。頼まれごとを受ける前に、時間と気力と優先順位を一度だけ確認してから返すと、あなたらしい誠実さがそのまま伝わります。

## 仕事と人間関係

仕事や日常の選び方では、広げるより絞る日。アイデアを増やすよりも、目的に合わないものを削るほうが結果につながります。お金や買い物は、衝動より比較・保留が吉。

人間関係では、相手の反応を読みすぎないこと。好きな人や近い人ほど「本当はどう思っているのだろう」と推理したくなりますが、今日は相手の気持ちを当てにいくより、自分の希望を短く出すほうが関係が動きます。「少し話せる？」「この日どう？」のように相手が答えやすい形にすると流れが軽くなります。

## 気をつけたいクセ

あなたの性質に出やすい癖として「${shuku.caution}」点には今日特に注意。${reversed ? "感情のもやが思考にかぶさり、決めなくていいことまで急ぎたくなる" : "勢いそのままに、本音の確認を飛ばしてしまう"}ことが起こりがちです。決める前にひと呼吸、自分に「これは本当に今やる？」と聞いてあげてください。

## 今日やるとよい3つのこと

1. 気になっている小さな未完了をひとつだけ片づける。
2. ${reversed ? "ノートかメモに、今のもやもやを2行だけ言葉にする" : "誰かに、いま一番ありがたいと思っていることを短く伝える"}。
3. ${shuku.strength.replace(/。$/,"")}を、ふだんよりほんの少しだけ意識して動く。

## 今日のキーフレーズ

${reversed ? `「${shuku.theme}」を、内側からそっと整える日。` : `「${shuku.theme}」を、まっすぐ表に出していい日。`}`;
}

// ===== Vercel handler =====
module.exports = async (req, res) => {
  // CORS (同一オリジンなのでほぼ不要だが安全に)
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  let body = req.body;
  if (!body || typeof body !== "object") {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      return res.status(400).json({ error: "invalid JSON body" });
    }
  }

  const birthDate = String(body.birthDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return res.status(400).json({ error: "birthDate must be YYYY-MM-DD" });
  }
  const cardId = Number(body.cardId);
  if (!Number.isInteger(cardId) || cardId < 0 || cardId >= tarotData.length) {
    return res.status(400).json({ error: "invalid cardId" });
  }
  const reversed = Boolean(body.reversed);

  const [yy, mm, dd] = birthDate.split("-").map(Number);
  const shuku = resolveShuku(yy, mm, dd);
  const card = tarotData[cardId];

  const llm = await callOpenRouter({ birthDate, shuku, card, reversed });
  let reading;
  let source;
  if (llm.text) {
    reading = llm.text;
    source = "llm";
  } else {
    reading = localFallback({ shuku, card, reversed });
    source = "fallback";
  }

  console.log(`[reading] done source=${source} bd=${birthDate} card=${card.id}/${card.name} reversed=${reversed}`);

  return res.status(200).json({
    reading,
    card: { id: card.id, jp: card.jp, name: card.name },
    reversed,
    source,
    modelUsed: llm.modelUsed || null,
    upstreamError: llm.error || null,
  });
};
