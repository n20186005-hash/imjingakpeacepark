/**
 * 单景点 SEO 实体绑定配置（Single-Attraction Entity Binding）
 *
 * 本文件集中声明该景点在结构化数据、TDK、地图、NAP 中复用的全部实体变量，
 * 对应需求文档中的变量占位符（{{DOMAIN_NAME}} 等）。修改景点时仅需改这里。
 *
 * | 占位符                      | 本文件字段                                        |
 * | --------------------------- | ------------------------------------------------- |
 * | {{DOMAIN_NAME}}             | domain                                            |
 * | {{ATTRACTION_FULL_NAME}}    | fullName / fullNameLocal[lang]                    |
 * | {{ATTRACTION_SHORT_NAME}}   | shortName                                         |
 * | {{CITY_NAME}}               | city                                              |
 * | {{STATE_PROVINCE}}          | state                                             |
 * | {{COUNTRY_NAME}}            | country                                           |
 * | {{COUNTRY_CODE_2LETTER}}    | countryCode                                       |
 * | {{POSTAL_CODE}}             | postalCode                                        |
 * | {{LATITUDE}}                | latitude                                          |
 * | {{LONGITUDE}}               | longitude                                         |
 * | {{MAPS_SHARE_URL}}          | mapsShareUrl                                      |
 * | {{MAPS_EMBED_SRC}}          | mapsEmbedSrc(lang)                                |
 * | {{NEARBY_LANDMARK_1}}       | nearbyLandmarks[0]                                |
 * | {{NEARBY_LANDMARK_2}}       | nearbyLandmarks[1]                                |
 * | {{GOVT_TOURISM_URL}}        | govtTourismUrl                                    |
 */

export const entity = {
  /** {{DOMAIN_NAME}} */
  domain: 'imjingakpeacepark.com',
  baseUrl: 'https://imjingakpeacepark.com',

  /** {{ATTRACTION_FULL_NAME}} —— 官方全称（英文/罗马字，用于结构化数据） */
  fullName: 'Imjingak Pyeonghwa Nuri Park',
  /** 各语言下的官方全称，用于 H1/NAP 等展示层 */
  fullNameLocal: {
    zh: '临津阁和平公园',
    en: 'Imjingak Pyeonghwa Nuri Park',
    ja: '臨津閣平和ヌリ公園',
    ko: '임진각 평화누리공원',
  } as Record<string, string>,
  /** {{ATTRACTION_SHORT_NAME}} —— 域名含义对应的常用俗称 */
  shortName: 'Imjingak Peace Park',

  /** {{CITY_NAME}} */
  city: 'Paju-si',
  /** {{STATE_PROVINCE}} */
  state: 'Gyeonggi-do',
  /** {{COUNTRY_NAME}} */
  country: 'South Korea',
  /** {{COUNTRY_CODE_2LETTER}} */
  countryCode: 'KR',
  /** {{POSTAL_CODE}} */
  postalCode: '10808',

  /** {{LATITUDE}} / {{LONGITUDE}} */
  latitude: 37.8902,
  longitude: 126.7702,

  /**
   * 景点地理环境画像 —— 天气模块据此输出「场景化」建议。
   *
   * 城市天气预报只回答「多少度、下不下雨」，而落地页需要回答游客真正关心的问题：
   * 江边要不要防涨水、周边步道会不会湿滑、缆车会不会因大风停运。
   * 因此这里显式声明地形与场地特征，由 weatherAdvice 引擎按需追加专项建议。
   */
  venue: {
    /** 主导地形：临津江畔的江河型场地 */
    terrain: 'river',
    /** 临水：园区沿临津江铺开，需输出亲水安全与涨水提示 */
    waterfront: true,
    /** 有山地/丘陵步道：周边坡道在雨雪后易湿滑 */
    hillsTrail: true,
    /** 有缆车等露天高空设施：大风与雷雨时可能停运 */
    aerialRide: true,
    /** 有成片植被：夏季需提示防蚊虫 */
    vegetation: true,
    /** 园内有可避雨的封闭场馆 */
    shelter: true,
  },

  /** NAP —— 与 Google 地图资料保持完全一致 */
  streetAddress: '148-40 Imjingak-ro, Munsan-eup',
  telephone: '+82 31 956 8300',
  /** 与地图资料一致的国家/地区写法 */
  addressLocality: 'Paju-si',
  addressRegion: 'Gyeonggi-do',
  addressCountryFull: 'South Korea',

  /** Google Plus Code —— 与地图资料保持一致，游客可据此直接定位，也补足本地检索的地址信号 */
  plusCode: 'VPRV+V6 Paju-si, Gyeonggi-do',

  /** {{MAPS_SHARE_URL}} */
  mapsShareUrl: 'https://maps.app.goo.gl/dUgMXau27SzsDpqQ9',
  /**
   * {{MAPS_EMBED_SRC}} —— Google 地图 iframe（临津阁和平公园）的固定部分。
   *
   * 链接中 `!3m2!1s<hl>!2sus` 与 `!5m2!1s<hl>!2sus` 两处都是「地图界面语言」，
   * 必须同时替换，只改一处会让地图回落到默认语言。因此这里只保留不变的部分，
   * 由下方的 mapsEmbedSrc(lang) 按当前页面语言拼出完整链接。
   */
  mapsEmbedPb:
    '!1m5!3m1!1s0x357cf22deb81b203:0xa1f289873f84d1a2!2z5Li05rSl6ZiB5ZKM5bmz5YWs5Zut!5e1',

  /** {{GOVT_TOURISM_URL}} —— 权威政府/官方旅游门户 */
  govtTourismUrl: 'https://ggtour.or.kr/dmz/',

  /** {{NEARBY_LANDMARK_1}} / {{NEARBY_LANDMARK_2}} 及更多周边地标 */
  nearbyLandmarks: [
    'Imjingak Peace Gondola',
    'Dorasan Observatory',
    'Third Infiltration Tunnel',
    'Heyri Art Valley',
  ],

  /** 主视觉图与结构化数据图片节点 */
  heroImage: 'https://imjingakpeacepark.com/gallery/imjingak-pyeonghwa-nuri-park-1.jpg',
  images: [
    'https://imjingakpeacepark.com/gallery/imjingak-pyeonghwa-nuri-park-1.jpg',
    'https://imjingakpeacepark.com/gallery/imjingak-pyeonghwa-nuri-park-3.jpg',
    'https://imjingakpeacepark.com/gallery/imjingak-pyeonghwa-nuri-park-5.jpg',
  ],
} as const;

export type Entity = typeof entity;

/**
 * 生成与页面语言一致的 Google 地图嵌入链接。
 *
 * pb 参数里的 hl（地图界面语言）出现两次，这里统一按同一语言替换，
 * 保证任意语言页面上的地图都用该语言显示地名与界面按钮。
 *
 * @param hl 地图界面语言，取值与 <html lang> 一致：zh-CN / en / ja / ko
 */
export function mapsEmbedSrc(hl: string): string {
  return `https://www.google.com/maps/embed?pb=${entity.mapsEmbedPb}!3m2!1s${hl}!2sus!4v1789098227767!5m2!1s${hl}!2sus`;
}
