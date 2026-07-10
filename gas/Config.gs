// 環境設定。スプレッドシートIDと定数はここに集約する。

const CONFIG = {
  SPREADSHEET_ID: '1SlI0kHR637Ytv6PVfONU9w9og4lKetZn7GtDZIa3OrE',

  SHEETS: {
    TEAMS:    'teams',
    MEMBERS:  'members',
    SCORES:   'scores',
    SETTINGS: 'settings',
  },

  GAME_START: '2026-07-13T00:00:00+09:00',
  WEEK_ENDS: [
    '2026-07-19T23:59:59+09:00',
    '2026-07-26T23:59:59+09:00',
    '2026-08-02T23:59:59+09:00',
    '2026-08-12T23:59:59+09:00', // 第4週締め（8/12まで延長）
  ],

  ACTIVITIES: {
    key_skills:      { label: 'キースキルズトレーニング',                    points:  1, sign: '+' },
    mindset:         { label: 'マインドセットトレーニング',                  points:  1, sign: '+' },
    training_other:  { label: 'その他BNIトレーニング（ネットワーキング/ディベロップ等）', points:  1, sign: '+' },
    ms_addon:        { label: 'MSアドオン受講',                              points:  2, sign: '+' },
    pt_ws_first:     { label: 'パワーチームWS 前半（ターゲットマーケット）',  points:  5, sign: '+' },
    pt_ws_second:    { label: 'パワーチームWS 後半（パワーチーム構築）',      points: 10, sign: '+' },
    one_to_one:      { label: '1to1（30分以上）',                            points:  1, sign: '+' },
    visitor:         { label: 'ビジター招待',                                points:  3, sign: '+' },
    testimonial:     { label: '推薦の言葉',                                  points:  2, sign: '+', teamWeeklyCap: 3 },
    absent:          { label: '欠席',                                        points: 10, sign: '-' },
    late:            { label: '遅刻・早退',                                  points:  5, sign: '-' },
  },
};

// 初期チーム編成（スプレッドシートから読んだ実データ）
const INITIAL_TEAMS = [
  { name: 'チーム1',      members: ['西平 泰士','玉城 一朗','比嘉 基','宮城 卓朗','上原 繁猛'] },
  { name: '知念工務店',   members: ['松田 謙','金城 孝文','知念 直明','塩川 健勇'] },
  { name: 'チーム3',      members: ['宮里 判','中村 利枝','座間味 亮','八巻 徳幸'] },
  { name: 'チーム4',      members: ['安慶名 紀昭','新川 浩司','島袋 麗央','諸見里 杉子'] },
  { name: 'チーム5',      members: ['高橋 利佑一','金城 杉志郎','與那嶺 新','角江 明彦','中尾 善弘'] },
  { name: 'チーム6',      members: ['宮本 達矢','奥平 雄太','平 大治郎','東恩納 洋','洲鎌 晃'] },
  { name: 'ギネス',       members: ['當真 嗣剛','金 学辰','小波津 啓史','崎原 光明','カヲル'] },
  { name: 'KKKパンダ',    members: ['Belle ベル','稲福 剛治','伊志嶺 周','棚原 憲勇','宮國 桂光'] },
  { name: '縁結サマーズ', members: ['比嘉 太一','上門 春菜','Nika ニカ','比嘉 美奈子','尾辻 克敏'] },
  { name: 'ザハーレム',   members: ['亀井 奈紀沙','白坂 剛士','上原 み和','浜元 新菜','前川 麻里奈'] },
  { name: 'ついちゃんズ', members: ['小出 一登','山田 カール和彦','後小橋川 梨帆','上江洲 俊介','中村 淳男'] },
  { name: '無遅刻無欠席', members: ['小橋川 牧','湯川 具人','伊集 朝和','辻野 幸太郎','謝花 斉'] },
  { name: 'チーム13',     members: ['湧川 洋邦','金城 智史','南 竜二','宮城 卓也','又吉 亮太'] },
  { name: '女子入れろ',   members: ['唐沢 達雄','伊仲 道千丞','島袋 利信','柴田 博人','中里 迅志'] },
  { name: '美幸爆破家',   members: ['金城 恵輔','譜久村 美幸','安次富 義人','砂川 奨太','玉城 判'] },
  { name: 'お月様S',      members: ['藤木 彰','月乃 美椅浬','奥原 君代','大城 卓実','慶田盛 克磨'] },
  { name: 'ピオミキヤ',   members: ['近藤 彩加','宮城 達','大城 知也','金城 学','山川 宗克'] },
];
