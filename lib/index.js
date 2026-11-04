/**
 * 实验性宿主插件：把会话检索挂成一个工具，让 DSH 里的 agent 自己查历史原话。
 *
 * ⚠️ 各版本 DSH 的工具注册入口不一样，这里做了宽匹配；注册不上就只打日志、
 * 不影响宿主启动。稳定用法是 CLI（bin/cli.mjs）或 skill（skill/SKILL.md）。
 */
import { defaultRoot, loadAll, messages, pick, find, fmtTime } from './session.mjs';

export const name = 'dsh-session-grep';

const TOOL = {
  name: 'dsh_session',
  description:
    '读取本机 DSH 会话原话（会话文件是多帧 zstd，普通 grep 搜不到）。'
    + 'mode=list 列会话；mode=find 按正则全库搜；mode=dump 按 seq 取某段；mode=around 取某条前后。',
  parameters: {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['list', 'find', 'dump', 'around'] },
      pattern: { type: 'string', description: 'find 用的正则；title 关键词也走这里' },
      session: { type: 'string', description: '会话 id 片段（dump/around 用）' },
      seq: { type: 'number', description: 'around 的中心 seq' },
      lo: { type: 'number' },
      hi: { type: 'number' },
      width: { type: 'number', description: 'around 前后条数，默认 6；find 的上下文宽，默认 200' },
      limit: { type: 'number', description: 'find 最多返回条数，默认 20' },
    },
    required: ['mode'],
  },
};

function run(args) {
  const root = process.env.DSH_SESSION_ROOT || defaultRoot();
  const all = loadAll(root);
  if (args.mode === 'list') {
    return all.map(s => `${s.id.slice(0, 20)}  ${fmtTime(s.createdAt)}  ${messages(s).length} 条  ${s.cwd}  「${s.title}」`).join('\n');
  }
  if (args.mode === 'find') {
    const hits = find(all, args.pattern || '', { context: args.width ?? 200, limit: args.limit ?? 20 });
    return hits.map(h => `### ${h.session.slice(0, 16)} [seq ${h.seq}] ${h.role} ${fmtTime(h.time)}\n${h.snippet}`).join('\n\n') || '无命中';
  }
  const s = pick(all, args.session || '');
  const lo = args.mode === 'dump' ? (args.lo ?? 0) : (args.seq ?? 0) - (args.width ?? 6);
  const hi = args.mode === 'dump' ? (args.hi ?? Number.MAX_SAFE_INTEGER) : (args.seq ?? 0) + (args.width ?? 6);
  return messages(s).filter(m => m.seq >= lo && m.seq <= hi)
    .map(m => `===== [${m.seq}] ${m.role} ${fmtTime(m.time)}\n${m.text}`).join('\n\n') || '该区间没有消息';
}

export function apply(ctx) {
  const candidates = [ctx?.tools, ctx?.get?.('tools'), ctx?.agent?.ctx?.tools];
  const api = candidates.find(c => c && typeof c.register === 'function');
  if (!api) {
    ctx?.logger?.warn?.('[dsh-session-grep] 没找到工具注册入口，只能用 CLI/skill。');
    return;
  }
  try {
    api.register({ ...TOOL, execute: async args => run(args) });
    ctx?.logger?.info?.('[dsh-session-grep] 工具 dsh_session 已注册。');
  } catch (err) {
    ctx?.logger?.warn?.(`[dsh-session-grep] 工具注册失败：${err?.message || err}`);
  }
}
