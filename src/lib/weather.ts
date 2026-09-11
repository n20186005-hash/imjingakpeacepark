/**
 * 天气数据模块（服务端获取 + 内存缓存）
 *
 * 该模块仅在服务端运行（Astro 组件 frontmatter / 构建期），负责向气象数据服务
 * 请求「当前天气 + 逐小时 + 未来 7 天预报」，并在进程内做 TTL 缓存，
 * 避免同一进程内重复请求。任何网络异常都会被吞掉并回退为 null，
 * 保证页面在数据不可用时仍可正常渲染。
 */
import { entity } from '../config/entity';

export type WeatherLang = 'zh' | 'en' | 'ja' | 'ko';

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  weatherCode: number;
  isDay: boolean;
  precipitation: number;
  /** 能见度（米） */
  visibility: number;
  /** 露点温度（℃） */
  dewPoint: number;
  /** 当前紫外线指数 */
  uvIndex: number;
}

export interface HourlyWeather {
  time: string;
  temperature: number;
  weatherCode: number;
  precipitationProbability: number;
}

export interface DailyWeather {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
  precipitationSum: number;
  uvIndexMax: number;
  sunrise: string;
  sunset: string;
  windSpeedMax: number;
  /** 当日最大阵风（km/h） */
  windGustsMax: number;
  /** 当日最低能见度（米） */
  visibilityMin: number;
  /** 当日最大积雪深度（米） */
  snowDepthMax: number;
}

export interface WeatherData {
  current: CurrentWeather;
  hourly: HourlyWeather[];
  daily: DailyWeather[];
  timezone: string;
  timezoneAbbr: string;
  utcOffsetSeconds: number;
  fetchedAt: number;
}

/** 缓存有效期：30 分钟 */
const CACHE_TTL_MS = 30 * 60 * 1000;

let cache: { data: WeatherData; expiresAt: number } | null = null;
let inflight: Promise<WeatherData | null> | null = null;

const API_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'visibility',
  'dew_point_2m',
  'uv_index',
];

const HOURLY_FIELDS = ['temperature_2m', 'weather_code', 'precipitation_probability'];

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'sunrise',
  'sunset',
  'precipitation_sum',
  'precipitation_probability_max',
  'uv_index_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'visibility_min',
  'snow_depth_max',
];

function buildUrl(): string {
  const params = new URLSearchParams({
    latitude: String(entity.latitude),
    longitude: String(entity.longitude),
    current: CURRENT_FIELDS.join(','),
    hourly: HOURLY_FIELDS.join(','),
    daily: DAILY_FIELDS.join(','),
    timezone: 'auto',
    forecast_days: '7',
    wind_speed_unit: 'kmh',
  });
  return `${API_ENDPOINT}?${params.toString()}`;
}

function pickHourly(payload: any, nowIndex: number): HourlyWeather[] {
  const h = payload?.hourly ?? {};
  const times: string[] = h.time ?? [];
  const out: HourlyWeather[] = [];
  for (let i = nowIndex; i < times.length && out.length < 12; i += 1) {
    out.push({
      time: times[i],
      temperature: h.temperature_2m?.[i] ?? 0,
      weatherCode: h.weather_code?.[i] ?? 0,
      precipitationProbability: h.precipitation_probability?.[i] ?? 0,
    });
  }
  return out;
}

function pickDaily(payload: any): DailyWeather[] {
  const d = payload?.daily ?? {};
  const dates: string[] = d.time ?? [];
  return dates.slice(0, 7).map((date, i) => ({
    date,
    weatherCode: d.weather_code?.[i] ?? 0,
    tempMax: d.temperature_2m_max?.[i] ?? 0,
    tempMin: d.temperature_2m_min?.[i] ?? 0,
    precipitationProbability: d.precipitation_probability_max?.[i] ?? 0,
    precipitationSum: d.precipitation_sum?.[i] ?? 0,
    uvIndexMax: d.uv_index_max?.[i] ?? 0,
    sunrise: d.sunrise?.[i] ?? '',
    sunset: d.sunset?.[i] ?? '',
    windSpeedMax: d.wind_speed_10m_max?.[i] ?? 0,
    windGustsMax: d.wind_gusts_10m_max?.[i] ?? 0,
    visibilityMin: d.visibility_min?.[i] ?? 0,
    snowDepthMax: d.snow_depth_max?.[i] ?? 0,
  }));
}

async function requestWeather(): Promise<WeatherData | null> {
  try {
    const res = await fetch(buildUrl(), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const payload: any = await res.json();

    const currentBlock = payload?.current ?? {};
    const isDay = currentBlock.is_day === 1 || currentBlock.is_day === true;
    const timezone: string = payload?.timezone ?? 'Asia/Seoul';
    const utcOffsetSeconds: number = payload?.utc_offset_seconds ?? 0;

    // 定位「当前时刻」在逐小时数组中的下标（接口返回的 current.time 为本地时间）
    const currentTime: string = currentBlock.time ?? '';
    const times: string[] = payload?.hourly?.time ?? [];
    let nowIndex = times.findIndex((t) => t === currentTime);
    if (nowIndex < 0) {
      nowIndex = times.findIndex((t) => t >= currentTime);
    }
    if (nowIndex < 0) nowIndex = 0;

    const data: WeatherData = {
      current: {
        temperature: currentBlock.temperature_2m ?? 0,
        apparentTemperature: currentBlock.apparent_temperature ?? 0,
        humidity: currentBlock.relative_humidity_2m ?? 0,
        windSpeed: currentBlock.wind_speed_10m ?? 0,
        windGusts: currentBlock.wind_gusts_10m ?? currentBlock.wind_speed_10m ?? 0,
        windDirection: currentBlock.wind_direction_10m ?? 0,
        weatherCode: currentBlock.weather_code ?? 0,
        isDay,
        precipitation: currentBlock.precipitation ?? 0,
        visibility: currentBlock.visibility ?? 0,
        dewPoint: currentBlock.dew_point_2m ?? 0,
        uvIndex: currentBlock.uv_index ?? 0,
      },
      hourly: pickHourly(payload, nowIndex),
      daily: pickDaily(payload),
      timezone,
      timezoneAbbr: utcOffsetSeconds === 32400 ? 'KST' : 'UTC+9',
      utcOffsetSeconds,
      fetchedAt: Date.now(),
    };

    if (!data.daily.length) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * 获取天气数据（带进程内 TTL 缓存）。
 * 在服务端渲染阶段调用；并发调用会复用同一个请求。
 */
export async function getWeather(): Promise<WeatherData | null> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;
  if (inflight) return inflight;

  inflight = requestWeather()
    .then((data) => {
      if (data) {
        cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
      } else if (cache) {
        // 请求失败时继续沿用上一次成功的数据
        cache = { data: cache.data, expiresAt: Date.now() + 5 * 60 * 1000 };
      }
      return data ?? cache?.data ?? null;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/* ------------------------------------------------------------------ */
/* 天气代码（WMO）→ 图标与多语言描述                                    */
/* ------------------------------------------------------------------ */

type Group =
  | 'clear'
  | 'mainlyClear'
  | 'partlyCloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'freezingDrizzle'
  | 'rain'
  | 'freezingRain'
  | 'snow'
  | 'snowGrains'
  | 'rainShowers'
  | 'snowShowers'
  | 'thunderstorm'
  | 'thunderstormHail';

const CODE_TO_GROUP: Record<number, Group> = {
  0: 'clear',
  1: 'mainlyClear',
  2: 'partlyCloudy',
  3: 'overcast',
  45: 'fog',
  48: 'fog',
  51: 'drizzle',
  53: 'drizzle',
  55: 'drizzle',
  56: 'freezingDrizzle',
  57: 'freezingDrizzle',
  61: 'rain',
  63: 'rain',
  65: 'rain',
  66: 'freezingRain',
  67: 'freezingRain',
  71: 'snow',
  73: 'snow',
  75: 'snow',
  77: 'snowGrains',
  80: 'rainShowers',
  81: 'rainShowers',
  82: 'rainShowers',
  85: 'snowShowers',
  86: 'snowShowers',
  95: 'thunderstorm',
  96: 'thunderstormHail',
  99: 'thunderstormHail',
};

const GROUP_ICON: Record<Group, string> = {
  clear: '☀️',
  mainlyClear: '🌤️',
  partlyCloudy: '⛅',
  overcast: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  freezingDrizzle: '🌧️',
  rain: '🌧️',
  freezingRain: '🌧️',
  snow: '🌨️',
  snowGrains: '❄️',
  rainShowers: '🌦️',
  snowShowers: '🌨️',
  thunderstorm: '⛈️',
  thunderstormHail: '⛈️',
};

const NIGHT_ICON: Partial<Record<Group, string>> = {
  clear: '🌙',
  mainlyClear: '🌙',
  partlyCloudy: '☁️',
};

/** 需要带伞 / 注意降水的天气组 */
const WET_GROUPS: Group[] = [
  'drizzle',
  'freezingDrizzle',
  'rain',
  'freezingRain',
  'rainShowers',
  'snow',
  'snowShowers',
  'snowGrains',
  'thunderstorm',
  'thunderstormHail',
];

export const WEATHER_LABELS: Record<WeatherLang, Record<Group, string>> = {
  ko: {
    clear: '맑음',
    mainlyClear: '대체로 맑음',
    partlyCloudy: '구름 조금',
    overcast: '흐림',
    fog: '안개',
    drizzle: '이슬비',
    freezingDrizzle: '어는 이슬비',
    rain: '비',
    freezingRain: '어는 비',
    snow: '눈',
    snowGrains: '싸락눈',
    rainShowers: '소나기',
    snowShowers: '눈 소나기',
    thunderstorm: '뇌우',
    thunderstormHail: '우박 동반 뇌우',
  },
  en: {
    clear: 'Clear',
    mainlyClear: 'Mainly clear',
    partlyCloudy: 'Partly cloudy',
    overcast: 'Overcast',
    fog: 'Fog',
    drizzle: 'Drizzle',
    freezingDrizzle: 'Freezing drizzle',
    rain: 'Rain',
    freezingRain: 'Freezing rain',
    snow: 'Snow',
    snowGrains: 'Snow grains',
    rainShowers: 'Rain showers',
    snowShowers: 'Snow showers',
    thunderstorm: 'Thunderstorm',
    thunderstormHail: 'Thunderstorm with hail',
  },
  ja: {
    clear: '晴れ',
    mainlyClear: 'おおむね晴れ',
    partlyCloudy: '晴れ時々くもり',
    overcast: 'くもり',
    fog: '霧',
    drizzle: '霧雨',
    freezingDrizzle: '着氷性の霧雨',
    rain: '雨',
    freezingRain: '着氷性の雨',
    snow: '雪',
    snowGrains: '霧雪',
    rainShowers: 'にわか雨',
    snowShowers: 'にわか雪',
    thunderstorm: '雷雨',
    thunderstormHail: 'ひょうを伴う雷雨',
  },
  zh: {
    clear: '晴',
    mainlyClear: '大部晴朗',
    partlyCloudy: '局部多云',
    overcast: '阴',
    fog: '雾',
    drizzle: '毛毛雨',
    freezingDrizzle: '冻毛毛雨',
    rain: '雨',
    freezingRain: '冻雨',
    snow: '雪',
    snowGrains: '米雪',
    rainShowers: '阵雨',
    snowShowers: '阵雪',
    thunderstorm: '雷暴',
    thunderstormHail: '伴冰雹雷暴',
  },
};

export function weatherGroup(code: number): Group {
  return CODE_TO_GROUP[code] ?? 'partlyCloudy';
}

export function weatherIcon(code: number, isDay = true): string {
  const group = weatherGroup(code);
  if (!isDay && NIGHT_ICON[group]) return NIGHT_ICON[group] as string;
  return GROUP_ICON[group];
}

export function weatherLabel(code: number, lang: WeatherLang): string {
  const group = weatherGroup(code);
  return WEATHER_LABELS[lang]?.[group] ?? WEATHER_LABELS.en[group];
}

export function isWetCode(code: number): boolean {
  return WET_GROUPS.includes(weatherGroup(code));
}

/** 客户端刷新所需的本地化数据包（随页面内联，供列表重绘使用） */
export function clientPayload(lang: WeatherLang) {
  return {
    lang,
    locale: weatherLocale(lang),
    labels: WEATHER_LABELS[lang] ?? WEATHER_LABELS.en,
    groups: CODE_TO_GROUP,
    icons: GROUP_ICON,
    nightIcons: NIGHT_ICON,
    wet: WET_GROUPS,
  };
}

/** 用于 Intl 的 BCP-47 语言标记 */
export function weatherLocale(lang: WeatherLang): string {
  return { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' }[lang] ?? 'en-US';
}

/** 风力等级（蒲福风级简化的文字描述） */
export function windDescriptor(speedKmh: number, lang: WeatherLang): string {
  const table: Record<WeatherLang, string[]> = {
    ko: ['약함', '산들바람', '보통', '강함', '매우 강함'],
    en: ['Calm', 'Light breeze', 'Moderate', 'Strong', 'Very strong'],
    ja: ['弱い', 'そよ風', 'やや強い', '強い', '非常に強い'],
    zh: ['微风', '轻风', '中等', '强风', '很强'],
  };
  const idx = speedKmh < 6 ? 0 : speedKmh < 20 ? 1 : speedKmh < 40 ? 2 : speedKmh < 60 ? 3 : 4;
  return (table[lang] ?? table.en)[idx];
}

/**
 * 风速（km/h）→ 蒲福风级（0–12）。
 * 用于把「29–49 km/h」这类原始数值翻译成游客熟悉的「风力 5–6 级」。
 */
export function beaufortFor(speedKmh: number): number {
  const s = Math.max(0, speedKmh);
  const bounds = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  for (let i = 0; i < bounds.length; i += 1) {
    if (s < bounds[i]) return i;
  }
  return 12;
}

/** 是否为降雪 / 结冰类天气（含冻雨、冻毛毛雨、米雪） */
export function isSnowCode(code: number): boolean {
  const group = weatherGroup(code);
  return (
    group === 'snow' ||
    group === 'snowGrains' ||
    group === 'snowShowers' ||
    group === 'freezingRain' ||
    group === 'freezingDrizzle'
  );
}

/** 是否为雷暴类天气 */
export function isThunderCode(code: number): boolean {
  const group = weatherGroup(code);
  return group === 'thunderstorm' || group === 'thunderstormHail';
}

/** 降雨强度：'none' | 'light' | 'moderate' | 'heavy'（按 WMO 天气代码判定） */
export function rainIntensity(code: number): 'none' | 'light' | 'moderate' | 'heavy' {
  const group = weatherGroup(code);
  if (group === 'drizzle' || group === 'freezingDrizzle') return 'light';
  if (group === 'rain' || group === 'rainShowers' || group === 'freezingRain') {
    if (code === 65 || code === 82) return 'heavy';
    if (code === 63 || code === 81) return 'moderate';
    return 'light';
  }
  return 'none';
}
