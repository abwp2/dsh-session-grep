---
name: dsh-session-grep
description: 查 DSH 会话原话。DSH 会话文件是多帧 zstd，普通 grep 永远零命中；用这个技能按标题/正则/seq 取原文。
---

# 什么时候用

- 需要引用「某轮对话里到底怎么说的」，而 `read_own_chat` 只覆盖自己的会话；
- 需要查别的 Bot、别的工作区的历史；
- 需要确认「是不是我说过这句话」。

# 怎么用

```bash
node bin/cli.mjs list
node bin/cli.mjs title 关键词
node bin/cli.mjs find  "正则"             # 全库搜，40 条封顶
node bin/cli.mjs dump  <会话id片段> 300 330
node bin/cli.mjs around <会话id片段> 316 3
```

# 三条纪律

1. **先 `title` 再 `find`**：先定位会话，再在会话里搜，结果干净得多。
2. **时间默认北京时间**，输出用 `sv-SE` 格式（`2026-11-02 19:56:47`），不要自己再 +8。
3. **只引用 `role=user` / `role=assistant` 的 text**：`reasoning` 是内部思考，不是说出的话，本工具已经过滤掉了。
