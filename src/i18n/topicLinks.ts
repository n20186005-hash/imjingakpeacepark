export interface TopicLinkItem {
  slug: string;
  kicker: string;
  label: string;
  desc: string;
  cta: string;
}

export interface TopicLinksEntry {
  title: string;
  backLabel: string;
  items: TopicLinkItem[];
}

export const topicLinksByLang: Record<string, TopicLinksEntry> = {
  en: {
    title: "More visitor guides",
    backLabel: "Back to the main Imjingak guide",
    items: [
      { slug: "getting-there", kicker: "Transport", label: "How to get to Imjingak from Seoul", desc: "Train, bus, car and taxi options with transfer tips.", cta: "Full transport guide" },
      { slug: "getting-there-by-train", kicker: "Train", label: "Train to Imjingak from Seoul", desc: "Gyeongui-Jungang Line to Imjingang Station: express vs local, payment and the walk to Wind Hill.", cta: "Train guide" },
      { slug: "getting-there-by-bus", kicker: "Bus", label: "Bus to Imjingak from Seoul", desc: "Intercity bus to Paju or Munsan, then a city bus or taxi to the park.", cta: "Bus guide" },
      { slug: "imjingak-dmz-guide", kicker: "DMZ", label: "Imjingak & the DMZ guide", desc: "Free park vs paid gondola and DMZ tours, and ID rules.", cta: "Imjingak & DMZ guide" },
      { slug: "photos", kicker: "Photos", label: "Imjingak photos", desc: "Best photo spots and when to shoot them.", cta: "Photo spots guide" },
    ],
  },
  ko: {
    title: "더 보기 가이드",
    backLabel: "임진각 메인 가이드로 돌아가기",
    items: [
      { slug: "getting-there", kicker: "교통", label: "서울에서 임진각 가는 법", desc: "열차·버스·자가용·택시 옵션과 환승 팁.", cta: "교통 안내 전체 보기" },
      { slug: "getting-there-by-train", kicker: "열차", label: "임진각 행 열차 이용법", desc: "경의중앙선 임진강역 행 — 급행과 일반, 결제, 풍차의 언덕까지 도보.", cta: "열차 이용법" },
      { slug: "getting-there-by-bus", kicker: "버스", label: "임진각 행 버스 이용법", desc: "파주·문산 행 버스 후 시내버스나 택시로 공원까지.", cta: "버스 이용법" },
      { slug: "imjingak-dmz-guide", kicker: "DMZ", label: "임진각과 DMZ 가이드", desc: "무료 공원과 유료 곤돌라·DMZ 투어, 신분증 규정.", cta: "임진각·DMZ 가이드" },
      { slug: "photos", kicker: "사진", label: "임진각 사진 명소", desc: "추천 촬영 명소와 시간.", cta: "사진 명소 가이드" },
    ],
  },
  ja: {
    title: "あわせて読みたい",
    backLabel: "臨津閣メインガイドに戻る",
    items: [
      { slug: "getting-there", kicker: "アクセス", label: "ソウルから臨津閣への行き方", desc: "列車・バス・車・タクシーの選択肢と乗り継ぎのヒント.", cta: "交通ガイドを見る" },
      { slug: "getting-there-by-train", kicker: "電車", label: "臨津閣への電車利用法", desc: "京義・中央線臨津江駅行き — 急行と各駅、決済、風の丘までの徒歩.", cta: "電車の利用法" },
      { slug: "getting-there-by-bus", kicker: "バス", label: "臨津閣へのバス利用法", desc: "坡州・汶山行きバス後、市内バスかタクシーで公園へ.", cta: "バスの利用法" },
      { slug: "imjingak-dmz-guide", kicker: "DMZ", label: "臨津閣とDMZガイド", desc: "無料公園と有料ゴンドラ・DMZツアー、身分証の違い.", cta: "臨津閣・DMZガイド" },
      { slug: "photos", kicker: "写真", label: "臨津閣の写真名所", desc: "おすすめ撮影スポットと時間.", cta: "写真名所ガイド" },
    ],
  },
  zh: {
    title: "更多游览指南",
    backLabel: "返回临津阁主指南",
    items: [
      { slug: "getting-there", kicker: "交通", label: "从首尔怎么去临津阁", desc: "火车、巴士、自驾与出租选项及换乘提示.", cta: "查看完整交通指南" },
      { slug: "getting-there-by-train", kicker: "火车", label: "从首尔坐火车去临津阁", desc: "京义中央线至临津江站：快车与各站、支付方式与步行至风之丘.", cta: "火车乘坐指南" },
      { slug: "getting-there-by-bus", kicker: "巴士", label: "从首尔坐巴士去临津阁", desc: "到坡州或汶山的长途巴士，再转市内巴士或出租车到园区.", cta: "巴士乘坐指南" },
      { slug: "imjingak-dmz-guide", kicker: "DMZ", label: "临津阁与 DMZ 指南", desc: "免费公园与付费缆车、DMZ 行程及证件区别.", cta: "临津阁与 DMZ 指南" },
      { slug: "photos", kicker: "照片", label: "临津阁实拍照片", desc: "最佳拍照机位与时机.", cta: "拍照机位指南" },
    ],
  },
};
