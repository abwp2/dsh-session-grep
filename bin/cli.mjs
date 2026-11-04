#!/usr/bin/env node
/**
 * dsh-session —— 命令行入口
 *
 *   dsh-session list                     列出全部会话（时间/条数/工作区/标题）
 *   dsh-session title <关键词>            按标题找会话
 *   dsh-session find  <正则> [上下文宽]    全库检索，默认 40 条封顶
 *   dsh-session dump  <会话id片段> [lo] [hi]
 *   dsh-session around <会话id片段> <seq> [前后条数]
 *
 * 时间按北京时间显示（sv-SE 格式 = ISO，避免 12/24 小时歧义）。
 */
import { defaultRoot, loadAll, messages, pick, find, fmtTime } from '../lib/session.mjs';

const [cmd, ...args] = process.argv.slice(2);
const root = process.env.DSH_SESSION_ROOT || defaultRoot();

function usage() {
  console.log(`用法：
  dsh-session list
  dsh-session title <关键词>
  dsh-session find <正则> [上下文宽=200]
  dsh-session dump <会话id片段> [lo] [hi]
  dsh-session around <会话id片段> <seq> [前后=6]

会话根：${root}（可用 DSH_SESSION_ROOT 覆盖）`);
}

if (!cmd || cmd === '-h' || cmd === '--help') { usage(); process.exit(0); }

const all = loadAll(root);

if (cmd === 'list') {
  for (const s of all) {
    console.log(`${s.id.slice(0, 20)}  ${fmtTime(s.createdAt)}  ${String(messages(s).length).padStart(4)} 条  ${s.cwd}  「${s.title}」`);
  }
} else if (cmd === 'title') {
  const kw = args[0] || '';
  const hits = all.filter(s => s.title.includes(kw));
  for (const s of hits) console.log(`${s.id}  ${fmtTime(s.createdAt)}  「${s.title}」  ${s.cwd}`);
  if (!hits.length) { console.error(`没有标题含「${kw}」的会话`); process.exit(1); }
} else if (cmd === 'find') {
  if (!args[0]) { usage(); process.exit(1); }
  const hits = find(all, args[0], { context: Number(args[1] || 200) });
  for (const h of hits) {
    console.log(`\n### ${h.session.slice(0, 16)} [seq ${h.seq}] ${h.role} ${fmtTime(h.time)}  「${h.title}」`);
    console.log(h.snippet);
  }
  console.log(`\n命中 ${hits.length} 条`);
} else if (cmd === 'dump' || cmd === 'around') {
  if (!args[0]) { usage(); process.exit(1); }
  const s = pick(all, args[0]);
  let lo, hi;
  if (cmd === 'dump') { lo = Number(args[1] ?? 0); hi = Number(args[2] ?? Number.MAX_SAFE_INTEGER); }
  else {
    if (args[1] === undefined) { usage(); process.exit(1); }
    const c = Number(args[1]); const w = Number(args[2] ?? 6); lo = c - w; hi = c + w;
  }
  console.log(`# ${s.id}  「${s.title}」  ${s.cwd}`);
  for (const m of messages(s)) {
    if (m.seq < lo || m.seq > hi) continue;
    console.log(`\n===== [${m.seq}] ${m.role} ${fmtTime(m.time)}`);
    console.log(m.text);
  }
} else {
  usage();
  process.exit(1);
}
