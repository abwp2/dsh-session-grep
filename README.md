# dsh-session-grep

**读 DeepSeek Harness 的会话原话。** DSH 把会话写成**多帧 zstd**（每次追加压一帧），
`zstdDecompressSync` 只解第一帧，`grep` / `Select-String` 也搜不到正文——
所以「查某轮到底怎么说的」这件事，用系统自带工具做不到。这个包把它做掉。

```bash
dsh-session title 部署                          # 先按标题找会话
dsh-session around session-a1b2c3d4 120 3      # 再看那条前后说了什么
dsh-session find "那条命令|部署方式"             # 或者全库正则搜
```

## English

DeepSeek Harness stores every session as a multi-frame zstd file: each append adds another frame, and `zstdDecompressSync` only decodes the first one, so a plain `grep` finds nothing even when the text is right there. This package splits the frames, decompresses them in order, and indexes messages by `seq`, so you can pull exact quotes instead of guessing.

```bash
dsh-session list                               # sessions: id, time, count, workspace, title
dsh-session title deploy                       # find a session by its generated title
dsh-session find "pattern|alternative" 3       # regex search, with context
dsh-session around session-a1b2c3d4 120 3      # N messages before and after a seq
```

Read-only: it never writes, modifies, or deletes session files, makes no network calls, and needs no API key. Requires Node >= 22.15 (for the built-in `zlib.zstdDecompressSync`).

## 为什么需要它

真实场景：会话里明明有那句话，两个 agent 各自 grep 了会话目录，都得到「零命中」，
于是互相确认「没人说过」——实际上记录就在那儿，只是压着。这个包会把它们拆开。

```
$ grep -r "那句话" ~/.dsh/sessions     # 零命中（内容是压缩的）
$ dsh-session find "那句话"            # 命中，还带时间、seq 和说话人
```

## 安装

```bash
# 直接用，不安装
npx dsh-session-grep list

# 或者全局装
npm i -g dsh-session-grep
dsh-session list
```

要求 Node ≥ 22.15（需要内置 `zlib.zstdDecompressSync`）。

## 命令

| 命令 | 作用 |
|---|---|
| `dsh-session list` | 列出全部会话：id 前缀、时间、消息条数、工作区、标题 |
| `dsh-session title <关键词>` | 按标题找会话（标题是 DSH 用首条消息自动生成的） |
| `dsh-session find <正则> [上下文宽]` | 全库检索，默认 40 条封顶，每条带 seq / 说话人 / 时间 |
| `dsh-session dump <id片段> [lo] [hi]` | 按 seq 区间打印 |
| `dsh-session around <id片段> <seq> [前后]` | 以某条为中心，前后各 N 条 |

会话根默认 `$DSH_HOME/sessions`，可用环境变量 `DSH_SESSION_ROOT` 覆盖。

## 它怎么处理消息

- 每条消息拆成 `role` + `text`。**只取 `text`，跳过 `reasoning` 和 `tool-call`**——
  内部思考不是「说出口的话」，混进引用会让你自己打脸。
- 时间统一按**北京时间**输出，格式 `YYYY-MM-DD HH:MM:SS`，不要自己再加 8 小时。
- 只读，不写、不改、不删任何会话文件。

## 作为 DSH 插件

仓库带 `cordis.patch.yml`，可作为 bundle 插件挂进 profile，注册一个 `dsh_session` 工具：

```bash
dsh plugin --profile web add github:abwp2/dsh-session-grep
```

⚠️ 工具注册入口在不同 DSH 版本上不一样（`ctx.tools` / `ctx.get('tools')` 都试过），
注册不上时**只打一条 warning，不影响宿主启动**。稳定路径是 CLI 和 `skill/SKILL.md`。

## 数据与隐私

- 只读本机会话文件；
- 不联网、不埋点、不需要任何 key；
- 输出里会出现你自己的聊天内容——贴 issue 前先脱敏。

## 许可

MIT。见 [LICENSE](LICENSE)。

---

## English (short)

`dsh-session-grep` reads DeepSeek Harness session transcripts. DSH stores sessions as
**multi-frame zstd** (one frame per append); the built-in single-shot decompressor only
returns the first frame, so `grep` finds nothing. This tool splits the frames, parses the
JSONL, and lets you quote exact messages by `seq`.

```bash
dsh-session list
dsh-session title <keyword>
dsh-session find "<regex>" [contextWidth]
dsh-session dump <sessionIdPrefix> [lo] [hi]
dsh-session around <sessionIdPrefix> <seq> [radius]
```

Read-only, no network, no keys. Node >= 22.15. MIT.
An experimental DSH bundle plugin (registers a `dsh_session` tool) is included;
the CLI and the skill are the supported paths.
