/**
 * 天气出行建议引擎（纯函数）
 *
 * 输入「当前 + 今日 + 明日」原始气象数据与景点地理画像，输出**结构化的建议条目**
 * （仅包含 i18n key 与参数，不含具体文案），由组件层负责翻译与渲染。
 * 服务端渲染与客户端定时刷新共用同一份逻辑，保证前后端结论完全一致。
 *
 * 设计原则（对照产品需求）：
 * 1. 只输出用户可执行的建议，不堆砌气象术语（「紫外线强」而非「辐照强度高」）。
 * 2. 不满足条件的条目**不会生成**，组件层无需再判断，天然做到「不需要就不展示」。
 * 3. 风险类条目优先级最高，由组件层置顶渲染；有风险时常规建议自动让位（数量上限收缩）。
 * 4. 概率类判断避免绝对化表述（降水概率 ≥60% 提示「大概率」而非「一定」）。
 * 5. 场景化：依据景点地理画像（临水 / 山地步道 / 露天高空设施 / 植被）追加专项建议，
 *    这是城市天气预报不具备的视角。
 */
import {
  beaufortFor,
  isSnowCode,
  isThunderCode,
  weatherGroup,
  rainIntensity,
} from './weather';

/** 建议分组 */
export type AdviceBucket = 'alert' | 'risk' | 'outfit' | 'plan' | 'items';

/** 单条建议：只描述「说什么」，不描述「怎么写」 */
export interface AdviceEntry {
  /** i18n key（weather.advice.<key>） */
  key: string;
  /** 风险条目的短名称 key，用于总览句拼接 */
  nameKey?: string;
  /** 文案占位符参数 */
  params?: Record<string, string | number>;
}

/** 景点地理画像 */
export interface VenueProfile {
  /**
   * 主导地形类型。当前景点为江河型（临津江畔），
   * 其余取值保留给同构站点复用，未使用的地形不会产生额外建议。
   */
  terrain: 'river' | 'mountain' | 'coast' | 'forest' | 'urban' | 'cave' | 'desert';
  /** 临水（江河湖海），触发涉水与亲水安全建议 */
  waterfront?: boolean;
  /** 有山地 / 丘陵步道，触发坡道湿滑与登山建议 */
  hillsTrail?: boolean;
  /** 有缆车、索道等受大风影响的露天高空设施 */
  aerialRide?: boolean;
  /** 有林地 / 草原，夏季触发驱虫与过敏提示 */
  vegetation?: boolean;
  /** 园内有可避雨的室内场馆 */
  shelter?: boolean;
}

export interface AdviceCurrentInput {
  weatherCode: number;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  /** 风速 km/h */
  windSpeed: number;
  /** 阵风 km/h */
  windGusts?: number;
  /** 能见度 m */
  visibility?: number;
  /** 当前紫外线指数 */
  uvIndex?: number;
}

export interface AdviceDailyInput {
  weatherCode?: number;
  tempMax: number;
  tempMin: number;
  /** 降水概率 % */
  precipitationProbability: number;
  /** 日累计降水量 mm */
  precipitationSum?: number;
  uvIndexMax?: number;
  windSpeedMax?: number;
  windGustsMax?: number;
  /** 当日最低能见度 m */
  visibilityMin?: number;
  /** 当日最大积雪深度 m */
  snowDepthMax?: number;
  sunrise?: string;
  sunset?: string;
}

export interface AdviceInput {
  current?: AdviceCurrentInput | null;
  today?: AdviceDailyInput | null;
  tomorrow?: AdviceDailyInput | null;
  venue: VenueProfile;
}

export interface AdviceResult {
  /** 总体基调，用于面板配色 */
  tone: 'good' | 'caution' | 'alert';
  /** 一句话总览的 i18n key */
  headlineKey: string;
  /** 总览句中 {name} 所用的风险名称 key */
  headlineNameKey?: string;
  /** 气象风险提示（置顶红色） */
  alerts: AdviceEntry[];
  /** 其他安全提醒（与 alerts 合并渲染） */
  risks: AdviceEntry[];
  /** 出行穿搭 */
  outfit: AdviceEntry[];
  /** 游玩安排 */
  plan: AdviceEntry[];
  /** 随身物品 */
  items: AdviceEntry[];
}

/* --------------------------- 阈值集中声明 --------------------------- */

export const ADVICE_THRESHOLDS = {
  /** 降水概率达到该值即提示带雨具 */
  rainUmbrella: 60,
  /** 建议顺带带伞的概率 */
  rainMaybe: 30,
  /** 高温：提醒缩短户外时间 */
  hotTemp: 32,
  /** 高温：升级为风险提示 */
  heatAlertTemp: 35,
  /** 低温：需要防寒 */
  coldTemp: 10,
  /** 低温：升级为风险提示（最低温） */
  coldAlertTemp: -12,
  /** 昼夜温差 */
  tempSwing: 8,
  /** 紫外线需要防晒 */
  uvProtect: 5,
  /** 紫外线需要强化提醒 */
  uvStrong: 8,
  /** 风力偏大（蒲福风级） */
  windStrong: 5,
  /** 大风风险（蒲福风级） */
  windAlert: 7,
  /** 能见度受限（米） */
  lowVisibility: 2000,
  /** 大雾风险（米） */
  fogAlert: 500,
} as const;

const MAX_ALERTS = 3;
const MAX_RISK_TOTAL = 4;

/** 顺序去重 + 数量上限的小工具，避免「不需要的条目也堆在页面上」 */
function bucket(limit: number) {
  const list: AdviceEntry[] = [];
  return {
    list,
    add(key: string, params?: Record<string, string | number>) {
      if (list.length >= limit) return;
      if (list.some((e) => e.key === key)) return;
      list.push(params ? { key, params } : { key });
    },
  };
}

/**
 * 依据天气与景点画像生成游客可执行的建议。
 * 传入数据缺失时会退化到保守判断（只用已有字段），不会抛错。
 */
export function buildAdvice(input: AdviceInput): AdviceResult {
  const venue: VenueProfile = input.venue;
  const cur = input.current ?? null;
  const today = input.today ?? null;

  const code = cur?.weatherCode ?? today?.weatherCode ?? 2;
  const group = weatherGroup(code);

  const thunder = isThunderCode(code);
  const snow = isSnowCode(code);
  const fog = group === 'fog';
  const intensity = rainIntensity(code);
  const rain = intensity !== 'none';
  const heavyRain = intensity === 'heavy' || (today?.precipitationSum ?? 0) >= 20;
  const clear = group === 'clear' || group === 'mainlyClear';
  const cloudy = group === 'overcast' || group === 'partlyCloudy';

  const tempMax = today?.tempMax ?? cur?.temperature ?? 0;
  const tempMin = today?.tempMin ?? cur?.temperature ?? 0;
  const feels = cur?.apparentTemperature ?? cur?.temperature ?? tempMax;
  const swing = tempMax - tempMin;
  const pop = Math.round(today?.precipitationProbability ?? 0);
  const sum = today?.precipitationSum ?? 0;
  const uv = Math.max(cur?.uvIndex ?? 0, today?.uvIndexMax ?? 0);
  const humidity = cur?.humidity ?? 0;
  const wind = Math.max(cur?.windSpeed ?? 0, today?.windSpeedMax ?? 0);
  const gust = Math.max(cur?.windGusts ?? 0, today?.windGustsMax ?? 0);
  const force = beaufortFor(wind);
  const gustForce = beaufortFor(gust);
  const visibility = Math.min(
    cur?.visibility && cur.visibility > 0 ? cur.visibility : Number.POSITIVE_INFINITY,
    today?.visibilityMin && today.visibilityMin > 0 ? today.visibilityMin : Number.POSITIVE_INFINITY,
  );
  const snowDepth = today?.snowDepthMax ?? 0;
  const sheltered = venue.shelter !== false;

  /* ------------------------- 1. 气象风险（置顶） ------------------------- */

  const alerts = bucket(MAX_ALERTS);
  if (thunder) alerts.list.push({ key: 'alThunder', nameKey: 'alThunderName' });
  if (heavyRain) alerts.list.push({ key: 'alHeavyRain', nameKey: 'alHeavyRainName' });
  if (force >= ADVICE_THRESHOLDS.windAlert || gustForce >= ADVICE_THRESHOLDS.windAlert + 1) {
    alerts.list.push({ key: 'alWind', nameKey: 'alWindName' });
  }
  if (snow && (snowDepth >= 0.03 || sum >= 5)) {
    alerts.list.push({ key: 'alSnow', nameKey: 'alSnowName' });
  }
  if (tempMax >= ADVICE_THRESHOLDS.heatAlertTemp) {
    alerts.list.push({ key: 'alHeat', nameKey: 'alHeatName' });
  }
  if (tempMin <= ADVICE_THRESHOLDS.coldAlertTemp) {
    alerts.list.push({ key: 'alCold', nameKey: 'alColdName' });
  }
  if (visibility <= ADVICE_THRESHOLDS.fogAlert) {
    alerts.list.push({ key: 'alFog', nameKey: 'alFogName' });
  }
  alerts.list.length = Math.min(alerts.list.length, MAX_ALERTS);

  /* --------------------- 2. 其他安全提醒（同区渲染） --------------------- */

  const riskBudget = Math.max(1, MAX_RISK_TOTAL - alerts.list.length);
  const risks = bucket(riskBudget);
  const hasRisk = (key: string) => alerts.list.some((a) => a.key === key);
  if (thunder) risks.add('rkThunder');
  if (heavyRain || sum >= 10) risks.add('rkHeavyRain');
  if (force >= ADVICE_THRESHOLDS.windStrong) risks.add('rkWind');
  if (visibility <= ADVICE_THRESHOLDS.lowVisibility) risks.add('rkFog');
  if (uv >= ADVICE_THRESHOLDS.uvStrong) risks.add('rkUv');
  if (tempMax >= ADVICE_THRESHOLDS.hotTemp && !hasRisk('alHeat')) risks.add('rkHeat');
  if (feels <= 0 && !hasRisk('alCold')) risks.add('rkCold');
  if (snow) risks.add('rkIcy');
  if (venue.waterfront && (rain || thunder || force >= ADVICE_THRESHOLDS.windStrong || pop >= 60)) {
    risks.add('rkRiver');
  }
  if (venue.hillsTrail && (rain || snow)) risks.add('rkTrail');

  /* --------------------------- 3. 出行穿搭 --------------------------- */

  const outfit = bucket(4);
  if (snow) outfit.add('outSnow');
  else if (rain) outfit.add('outRain');
  if (tempMax >= ADVICE_THRESHOLDS.hotTemp) outfit.add('outHot');
  else if (tempMax >= 26) outfit.add('outWarm');
  else if (tempMax >= 18) outfit.add('outMild');
  else if (tempMax >= ADVICE_THRESHOLDS.coldTemp) outfit.add('outCool');
  else outfit.add('outCold');
  if (swing > ADVICE_THRESHOLDS.tempSwing) outfit.add('outLayer');
  if (force >= ADVICE_THRESHOLDS.windStrong) outfit.add('outWind');
  if (uv >= ADVICE_THRESHOLDS.uvProtect) outfit.add('outUv');
  if (!rain && !snow && humidity >= 80 && tempMax >= 24) outfit.add('outHumid');
  if (!outfit.list.length) outfit.add('outMild');

  /* --------------------------- 4. 游玩安排 --------------------------- */

  const plan = bucket(5);
  if (thunder) plan.add('plThunderWater');
  if (heavyRain) plan.add(sheltered ? 'plRainNoOutdoor' : 'plRainPoorOutdoor');
  else if (rain) plan.add(intensity === 'light' ? 'plRainPoorOutdoor' : 'plRainIndoor');
  if (fog || visibility <= ADVICE_THRESHOLDS.lowVisibility) {
    plan.add('plFogView');
    plan.add('plFogTransport');
  }
  if (tempMax >= ADVICE_THRESHOLDS.hotTemp) {
    plan.add('plHeatShorten');
    plan.add('plHeatIndoor');
  } else if (tempMax <= ADVICE_THRESHOLDS.coldTemp - 5) {
    plan.add('plColdShorten');
  }
  if (force >= ADVICE_THRESHOLDS.windStrong && venue.waterfront) plan.add('plWindWater');
  if (force >= ADVICE_THRESHOLDS.windAlert && venue.aerialRide) plan.add('plWindAerial');
  if (force >= ADVICE_THRESHOLDS.windStrong) plan.add('plWindSecure');
  const calm = !rain && !thunder && !snow && !fog && visibility > ADVICE_THRESHOLDS.lowVisibility
    && tempMax < ADVICE_THRESHOLDS.hotTemp && tempMax > ADVICE_THRESHOLDS.coldTemp - 5;
  if (calm) {
    if (clear) plan.add('plSunrise');
    if (clear || cloudy) plan.add('plGoodDay');
  }
  if ((rain || snow) && venue.hillsTrail) plan.add('plTrailWet');
  if (venue.terrain === 'river' || venue.waterfront) plan.add('plSceneRiver');
  if (!plan.list.length) plan.add('plFallback');

  /* --------------------------- 5. 随身物品 --------------------------- */

  const items = bucket(5);
  if (heavyRain || thunder) {
    items.add('itRaincoat');
    items.add('itRaincoatNoLong');
  } else if (rain && pop >= ADVICE_THRESHOLDS.rainUmbrella) items.add('itUmbrella');
  else if (rain) items.add('itFoldingUmbrella');
  else if (pop >= ADVICE_THRESHOLDS.rainUmbrella) items.add('itUmbrella');
  else if (pop >= ADVICE_THRESHOLDS.rainMaybe) items.add('itFoldingUmbrella');
  if (uv >= ADVICE_THRESHOLDS.uvProtect) items.add('itSunKit');
  if (tempMax >= 30) {
    items.add('itWater');
    items.add('itHeatKit');
  }
  if (swing > ADVICE_THRESHOLDS.tempSwing || tempMax < 18) items.add('itLayer');
  if (tempMax <= ADVICE_THRESHOLDS.coldTemp) items.add('itWarmKit');
  if (force >= ADVICE_THRESHOLDS.windStrong || gustForce >= ADVICE_THRESHOLDS.windAlert) {
    items.add('itSparkleHat');
  }
  if (fog || visibility <= ADVICE_THRESHOLDS.lowVisibility) items.add('itMask');
  if (rain || snow) items.add('itNonSlip');
  if (!snow && tempMax >= 22 && venue.vegetation) items.add('itInsect');
  if (!items.list.length) items.add('itNone');

  /* ----------------------------- 6. 总览句 ----------------------------- */

  let headlineKey = 'hlMild';
  let headlineNameKey: string | undefined;
  if (alerts.list.length) {
    headlineKey = 'hlAlert';
    headlineNameKey = alerts.list[0].nameKey;
  } else if (thunder) headlineKey = 'hlThunder';
  else if (heavyRain) headlineKey = 'hlHeavyRain';
  else if (snow) headlineKey = 'hlSnow';
  else if (rain || pop >= ADVICE_THRESHOLDS.rainUmbrella) headlineKey = 'hlRain';
  else if (tempMax >= ADVICE_THRESHOLDS.hotTemp) headlineKey = 'hlHot';
  else if (tempMax <= ADVICE_THRESHOLDS.coldTemp) headlineKey = 'hlCold';
  else if (force >= ADVICE_THRESHOLDS.windStrong) headlineKey = 'hlWindy';
  else if (fog || visibility <= ADVICE_THRESHOLDS.lowVisibility) headlineKey = 'hlFog';
  else if (clear) headlineKey = 'hlGood';
  else if (cloudy) headlineKey = 'hlCloudy';

  const tone: AdviceResult['tone'] = alerts.list.length
    ? 'alert'
    : rain || snow || thunder || force >= ADVICE_THRESHOLDS.windStrong
      || tempMax >= ADVICE_THRESHOLDS.hotTemp || tempMax <= ADVICE_THRESHOLDS.coldTemp
      || fog || visibility <= ADVICE_THRESHOLDS.lowVisibility
      ? 'caution'
      : 'good';

  return {
    tone,
    headlineKey,
    headlineNameKey,
    alerts: alerts.list,
    risks: risks.list,
    outfit: outfit.list,
    plan: plan.list,
    items: items.list,
  };
}
