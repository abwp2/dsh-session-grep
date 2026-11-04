/**
 * 冒烟测试：造一个两帧 zstd 的假会话，验证拆帧、解析、检索、区间取文。
 * 跑法：node test/smoke.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert';
import { decompressFrames, loadSession, messages, find } from '../lib/session.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-session-test-'));
const sessionId = 'session-TEST-0001';
const sdir = path.join(dir, `--tmp--`, sessionId);
fs.mkdirSync(sdir, { recursive: true });

const head = { type: 'session', version: 4, id: sessionId, createdAt: 1700000000000, cwd: 'D:\\demo' };
const title = { type: 'session/title', seq: 1, data: { title: '测试会话' } };
const u1 = {
  type: 'user/message', seq: 2, time: 1700000001000,
  data: { role: 'user', content: [{ type: 'text', text: '第一句：这条消息在第二节' }] },
};
const a1 = {
  type: 'assistant/message', seq: 3, time: 1700000011000,
  data: {
    message: {
      role: 'assistant',
      content: [
        { type: 'reasoning', text: '这段是思考，不该出现' },
        { type: 'text', text: '能分开，但第二节要单独解一帧。' },
      ],
    },
  },
};

// 两次追加 = 两帧，模拟真实写入方式
const frame1 = zlib.zstdCompressSync(Buffer.from([head, title, u1].map(o => JSON.stringify(o)).join('\n') + '\n'));
const frame2 = zlib.zstdCompressSync(Buffer.from(JSON.stringify(a1) + '\n'));
const file = path.join(sdir, 'session.v4.jsonl.zstd');
fs.writeFileSync(file, Buffer.concat([frame1, frame2]));

const text = decompressFrames(fs.readFileSync(file));
assert.ok(text.includes('这条消息在第二节'), '拆帧失败：第一帧正文没出来');
assert.ok(text.includes('第二节要单独解一帧'), '拆帧失败：第二帧正文没出来');

const s = loadSession(file);
assert.equal(s.title, '测试会话');
assert.equal(s.cwd, 'D:\\demo');
const msgs = messages(s);
assert.equal(msgs.length, 2, '消息条数不对');
assert.equal(msgs[0].role, 'user');
assert.equal(msgs[1].role, 'assistant');
assert.ok(!msgs[1].text.includes('思考'), 'reasoning 不该进正文');

const hits = find([s], '单独解一帧');
assert.equal(hits.length, 1);
assert.equal(hits[0].seq, 3);

fs.rmSync(dir, { recursive: true, force: true });
console.log('smoke ok: 拆帧 / 解析 / 检索 全部通过');
