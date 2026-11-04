/**
 * 会话读取核心：DSH 的 session 文件是**多帧 zstd**（每追加一次压一帧），
 * `zstdDecompressSync` 只解第一帧，普通 grep 也搜不到正文。
 * 这里按 zstd 魔数拆帧、逐帧解压、再拼回 JSONL。
 *
 * 纯读取，不写任何东西。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

export function defaultRoot() {
  const home = process.env.DSH_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '', '.dsh');
  return path.join(home, 'sessions');
}

/** 拆帧解压，返回整段 JSONL 文本 */
export function decompressFrames(buf) {
  const starts = [];
  let i = 0;
  while ((i = buf.indexOf(MAGIC, i)) !== -1) { starts.push(i); i += 1; }
  if (!starts.length) return '';
  const out = [];
  for (let k = 0; k < starts.length; k++) {
    const s = starts[k];
    const e = k + 1 < starts.length ? starts[k + 1] : buf.length;
    try { out.push(zlib.zstdDecompressSync(buf.subarray(s, e)).toString('utf8')); } catch { /* 假帧头 */ }
  }
  return out.join('');
}

export function listFiles(root = defaultRoot()) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.zstd')) files.push(p);
    }
  })(root);
  return files;
}

function partsText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  // 只要真正说出口的 text；reasoning / tool-call 一律跳过
  return content
    .filter(p => p && typeof p === 'object' && p.type === 'text')
    .map(p => p.text || '')
    .join('');
}

export function loadSession(file) {
  const text = decompressFrames(fs.readFileSync(file));
  const records = [];
  let title = '', cwd = '', createdAt = 0, id = path.basename(path.dirname(file));
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    records.push(o);
    if (o.type === 'session') { cwd = o.cwd || ''; createdAt = o.createdAt || 0; id = o.id || id; }
    if (o.type === 'session/title') title = o.data?.title || '';
  }
  return { id, file, title, cwd, createdAt, records };
}

export function messages(session) {
  const out = [];
  for (const r of session.records) {
    if (!r.type || !r.type.endsWith('/message')) continue;
    const body = partsText((r.data?.message || r.data)?.content ?? r.data?.content);
    if (!body) continue;
    out.push({
      seq: r.seq,
      time: r.time || 0,
      role: r.data?.message?.role || r.data?.role || 'unknown',
      text: body,
    });
  }
  return out;
}

export function loadAll(root = defaultRoot()) {
  return listFiles(root).map(loadSession).sort((a, b) => b.createdAt - a.createdAt);
}

export function pick(all, key) {
  const hits = all.filter(s => s.id.includes(key) || s.title.includes(key) || s.file.includes(key));
  if (!hits.length) throw new Error(`no session matching: ${key}`);
  return hits[0];
}

/** 全库正则检索；返回命中片段 */
export function find(all, pattern, { context = 200, limit = 40 } = {}) {
  const re = new RegExp(pattern, 'g');
  const hits = [];
  for (const s of all) {
    for (const m of messages(s)) {
      re.lastIndex = 0;
      let hit;
      while ((hit = re.exec(m.text)) !== null) {
        const a = Math.max(0, hit.index - context);
        const b = Math.min(m.text.length, hit.index + hit[0].length + context);
        hits.push({
          session: s.id, title: s.title, seq: m.seq, role: m.role, time: m.time,
          match: hit[0], snippet: m.text.slice(a, b).replace(/\s+/g, ' '),
        });
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}

export function fmtTime(ms) {
  return ms ? new Date(ms).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }) : '';
}
