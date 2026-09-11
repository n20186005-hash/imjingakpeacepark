/**
 * 建议面板渲染器
 *
 * 把 weatherAdvice 引擎产出的「建议 key 列表」翻译成实际文案并渲染为 HTML 片段。
 * 服务端（首屏 SSR，保证无 JS 也能看到建议）与客户端（定时刷新后重绘）共用本函数，
 * 因此模板与判定逻辑都只有一份，不会出现前后端结论或样式不一致的问题。
 */
import { buildAdvice, type AdviceEntry, type AdviceInput, type AdviceResult } from './weatherAdvice';

/** 面板自身的 UI 文案（分组标题、说明等） */
export interface AdvicePanelUi {
  alertTitle: string;
  noAlert: string;
  note: string;
  footer: string;
  outfit: string;
  plan: string;
  items: string;
}

export interface AdviceRenderInput extends AdviceInput {
  /** i18n 的 weather.advice 字典 */
  dict: Record<string, string>;
  ui: AdvicePanelUi;
}

export interface AdvicePanel {
  tone: AdviceResult['tone'];
  hasAlert: boolean;
  html: string;
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 取出条目文案并填充占位符 */
function textOf(dict: Record<string, string>, entry: AdviceEntry): string {
  let out = dict[entry.key] ?? '';
  if (entry.params) {
    for (const name of Object.keys(entry.params)) {
      out = out.split(`{${name}}`).join(String(entry.params[name]));
    }
  }
  return out;
}

function bulletList(items: string, color: string): string {
  return (
    `<ul class="space-y-1.5 text-sm leading-relaxed" style="color: ${color};">` +
    items +
    `</ul>`
  );
}

const BULLET = '<span aria-hidden="true" class="shrink-0">✔</span>';
const BULLET_ALERT = '<span aria-hidden="true" class="shrink-0">•</span>';

/**
 * 生成建议面板的 HTML。
 * 不满足条件的建议不会出现在结果里，也不会有「空分组」——
 * 例如不下雨就不会出现雨伞条目，阴天也不会提示防晒。
 */
export function renderAdvicePanel(input: AdviceRenderInput): AdvicePanel {
  const { dict, ui, ...adviceInput } = input;
  const advice = buildAdvice(adviceInput);

  const headline = (() => {
    let out = dict[advice.headlineKey] ?? '';
    if (advice.headlineNameKey) {
      out = out.split('{name}').join(dict[advice.headlineNameKey] ?? '');
    }
    return out;
  })();

  const li = (entry: AdviceEntry, bullet: string) =>
    `<li class="flex gap-2">${bullet}<span>${esc(textOf(dict, entry))}</span></li>`;

  const groups = [
    { icon: '👕', title: ui.outfit, entries: advice.outfit },
    { icon: '🧭', title: ui.plan, entries: advice.plan },
    { icon: '🎒', title: ui.items, entries: advice.items },
  ]
    .filter((g) => g.entries.length > 0)
    .map(
      (g) =>
        `<div class="rounded-2xl border p-4" style="border-color: var(--border-color); background: var(--card-bg);">` +
        `<p class="text-sm font-semibold mb-2" style="color: var(--text-primary);">` +
        `<span aria-hidden="true">${g.icon}</span> ${esc(g.title)}</p>` +
        bulletList(g.entries.map((e) => li(e, BULLET)).join(''), 'var(--text-secondary)') +
        `</div>`,
    )
    .join('');

  // 风险与气象提示合并为一个置顶区块：先气象风险，再其他安全提醒
  const safety = [...advice.alerts, ...advice.risks];
  const riskNote = dict.rkNote ?? '';
  const safetyBlock = safety.length
    ? `<div class="rounded-2xl border px-4 py-3" style="border-color: rgba(220, 38, 38, 0.38); background: rgba(220, 38, 38, 0.09);">` +
      `<p class="text-sm font-semibold mb-2" style="color: #dc2626;">` +
      `<span aria-hidden="true">⚠️</span> ${esc(ui.alertTitle)}</p>` +
      bulletList(safety.map((e) => li(e, BULLET_ALERT)).join(''), 'var(--text-primary)') +
      (ui.footer ? `<p class="mt-2 text-xs leading-relaxed" style="color: var(--text-secondary);">${esc(ui.footer)}</p>` : '') +
      (riskNote ? `<p class="mt-1 text-xs leading-relaxed" style="color: var(--text-muted);">${esc(riskNote)}</p>` : '') +
      `</div>`
    : `<div class="rounded-2xl border px-4 py-3" style="border-color: rgba(22, 163, 74, 0.38); background: rgba(22, 163, 74, 0.08);">` +
      `<p class="text-sm font-medium" style="color: #16a34a;">` +
      `<span aria-hidden="true">✅</span> ${esc(ui.noAlert)}</p>` +
      `</div>`;

  const toneIcon = advice.tone === 'alert' ? '⚠️' : advice.tone === 'caution' ? '🌦️' : '💡';
  const html =
    `<p class="text-sm sm:text-base font-semibold mb-3" style="color: var(--text-primary);">` +
    `<span aria-hidden="true">${toneIcon}</span> ${esc(headline)}</p>` +
    safetyBlock +
    (groups ? `<div class="grid gap-3 sm:grid-cols-3 mt-3">${groups}</div>` : '') +
    (ui.note ? `<p class="mt-3 text-xs leading-relaxed" style="color: var(--text-muted);">${esc(ui.note)}</p>` : '');

  return { tone: advice.tone, hasAlert: advice.alerts.length > 0, html };
}
