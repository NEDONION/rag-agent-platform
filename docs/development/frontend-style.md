# 前端样式规范

> 💬 **一句话人话**：颜色一律用设计令牌（别写 `bg-white`、`text-slate-700`），
> 排版节奏交给 `globals.css`，组件只管自己那一层的层级差异。
> 这样暗色模式才不会坏，长回答才读得下去。

**最后更新**：2026-08-14

---

## 目录

- [1. 为什么需要这份规范](#1-为什么需要这份规范)
- [2. 颜色：只用令牌](#2-颜色只用令牌)
- [3. 排版：全局管节奏，组件管层级](#3-排版全局管节奏组件管层级)
- [4. 对话界面的层级约定](#4-对话界面的层级约定)
- [5. 样式预览页](#5-样式预览页)
- [6. 迁移进度](#6-迁移进度)
- [7. 已知坑](#7-已知坑)

---

## 1. 为什么需要这份规范

2026-08-14 重构对话界面前，代码里同时存在几类问题，它们都源于「没有约定」：

| 问题 | 后果 |
| --- | --- |
| `MessageItem` 里 24 处硬编码颜色（`bg-white` / `text-slate-700` / `bg-blue-600`） | **暗色模式完全不可用**，白底白字 |
| `globals.css` 两处重复的 `line-height: 1.2 !important`，最后一条命中 `.prose *` | 长回答几乎无法阅读，且组件无法局部覆盖 |
| 正文 `text-[11px]`、标题 `text-2xl` | 同一条消息里 11px 与 24px 并存，层级断裂 |
| 蓝 / 琥珀 / 靛蓝三套强调色同屏 | 视觉噪音，看不出哪个重要 |

项目已启用 `darkMode: ["class"]` 且 `ThemeProvider` 开了 `enableSystem`，
**暗色不是可选项**，写死颜色等于交付一个坏掉的主题。

---

## 2. 颜色：只用令牌

令牌定义在 `styles/globals.css` 的 `@layer base`，`:root` 与 `.dark` 各一套。

### 蓝白配色：蓝分三档，不是「只有一个蓝」

产品方向是**蓝白**。蓝不是只出现在主按钮上的点缀，而是贯穿全局的氛围色。
关键是分档，不是限量：

| 档位 | 用在哪 | 令牌 |
| --- | --- | --- |
| **满饱和** | 主操作按钮、进度条、当前步骤 | `bg-primary`（`221 83% 53%`） |
| **淡蓝底 + 蓝字** | hover / 选中 / 导航当前项 / 徽章 | `bg-accent` + `text-accent-foreground` |
| **蓝调中性** | 页面底色、卡片描边、次要文字 | `bg-muted` / `border-border` / `text-muted-foreground` |

> ⚠️ **中性色必须带蓝调，不能是零饱和的纯灰。**
> 这一条决定了界面「是蓝白还是黑白」。曾经把中性色设成 `0 0% 96.1%`（纯灰）
> 并要求「图标、导航、徽章一律中性」，结果整站变成黑白灰，观感冷硬。
> 现在中性色统一在 214~222 色相，与品牌蓝同源：
>
> | 令牌 | 值 | 实际颜色 |
> | --- | --- | --- |
> | `--muted` | `210 40% 96.5%` | `rgb(243,246,250)` 淡蓝白 |
> | `--accent` | `214 95% 94%` | `rgb(225,238,254)` 淡蓝 |
> | `--border` | `214 32% 91%` | `rgb(225,231,239)` 蓝灰 |
> | `--foreground` | `222 47% 11%` | `rgb(15,23,41)` 蓝黑（非纯黑） |

**要克制的是「同权重的蓝」，不是蓝本身。** 改造前登录页一屏有 5 处**同样醒目**的蓝
（语言胶囊、一键填充、登录按钮、立即注册、忘记密码），彼此争抢；
现在它们分布在三个不同档位上，主次一眼可辨。

`--primary` 被 8 个基础组件（Button / Badge / Switch / Checkbox / Slider / Progress /
Calendar / DatetimePicker）和 35 处调用点共享，改一处即全站生效——所以**不要在组件里
手写 `bg-blue-600`**，那会绕过分档体系。

### 语义色

`success` / `warning` / `info` 三组，各带一个 `-subtle` 浅底变体（暗色下自动转深底）：

```tsx
<span className="text-success">已配置</span>
<span className="text-destructive">未配置</span>
<div className="bg-warning-subtle text-warning">…</div>
```

**只用于表达状态，不用于装饰。** 加这三组之前，各页面各写各的绿和黄，
同一个「成功」在不同页面是 `text-green-600` / `bg-emerald-50` / `bg-green-500`。

| 用途 | 令牌类名 | 不要写 |
| --- | --- | --- |
| 页面/卡片背景 | `bg-background` / `bg-card` | `bg-white` |
| 页面次级底色 | `bg-muted/40` | `bg-slate-50` |
| 次级表面（用户气泡、代码块底） | `bg-muted` | `bg-slate-100` |
| 悬停/选中态 | `bg-accent` | `bg-gray-100` |
| 正文 | `text-foreground` | `text-slate-900` |
| 次要文字 | `text-muted-foreground` | `text-slate-500` |
| 描边、分隔线 | `border-border` | `border-slate-200` |

需要透明度时用斜杠语法：`bg-muted/50`、`text-foreground/90`。
在 CSS 文件里则写 `hsl(var(--muted) / 0.5)`。

> **同一屏内不要出现两处满饱和蓝。** 对话流里最该被看见的是回答本身，
> 用户气泡用 `bg-muted`（蓝调浅底）而非满饱和主色——一屏里往往有多条用户消息，
> 高饱和色块会持续抢走视线。淡蓝底不受此限，它本来就是背景层。

---

## 3. 排版：全局管节奏，组件管层级

分工是硬性的：

- **`styles/globals.css` 的 `.react-markdown` 规则**：垂直节奏（`margin`）、行高、
  断行、以及「裸用时」的默认外观。间距用 `em`，随字号缩放。
- **组件**：只覆盖本处特有的层级差异——字号、文字颜色。

不要在全局加 `!important`。历史上这里出现过一轮军备竞赛（注释写着「更激进的紧凑间距」
「强制覆盖」「最终的通用行间距覆盖」），结果是任何组件都改不动，只能继续加更强的规则。

### 基准值

| 项 | 值 |
| --- | --- |
| 正文 | 14px / `line-height: 1.7` |
| 思考过程等次要文本 | 13px |
| 行内代码 | `0.85em`（略小于正文，等宽字体在同字号下显得过重） |
| 标题行高 | 1.3 |

**中英混排的正文行高不要低于 1.6。** 1.2 只适合标题。

### 对话内的标题只收敛到三档

| 元素 | 字号 |
| --- | --- |
| `h1` | 16px `font-semibold` |
| `h2` | 15px `font-semibold` |
| `h3` 及以下 | 14px |

回答是嵌在对话流里的，不是独立文章。24px 的大标题会让单条消息看起来像另一个页面。

---

## 4. 对话界面的层级约定

从强到弱共三层，**同层用同一套视觉语言**：

| 层级 | 内容 | 表现 |
| --- | --- | --- |
| 主体 | 助手的回答 | 平铺，无气泡无边框。长回答内部已有标题/列表/表格建立层级，外层再套边框会把它压成一个「块」 |
| 对等 | 用户提问 | 靠右，`bg-muted` 低饱和气泡 |
| 次要 | 检索过程、思考过程 | 中性色 + 一条左侧竖线（`border-l border-border`）表达从属，靠缩进而非边框 |

引用来源是回答的附属，用 `border-border` 的列表容器，不用强调色卡片。

---

## 5. 样式预览页

改这几个组件时，不必造一次真实对话：

```
/dev-preview/chat
```

用假数据渲染 `MessageItem` / `ThinkingProcess` / `RetrievalProcess` / `ChatInputArea`，
覆盖长回答、表格、代码块、引用、流式态，并带亮/暗色切换。
源码在 `frontend/app/dev-preview/chat/page.tsx`，**生产构建下返回 404**。

---

## 6. 迁移进度

全站硬编码颜色（`bg-white`、`text-slate-*`、`bg-blue-600` 一类）总量：

| 时间 | 数量 | 说明 |
| --- | --- | --- |
| 改造前 | 934 | 22 个页面 + 全部组件 |
| 2026-08-14 | 429 | 追加：三套对话面板 + Markdown 渲染器收敛为一份 |
| 2026-08-14 | **17** | 全站迁移完成，剩余均为合法用法（见下） |

**已改造完毕（硬编码归零）**：

- `styles/globals.css` + `tailwind.config.ts`（令牌与语义色）
- `components/navigation-bar.tsx`、`components/sidebar.tsx`
- `components/rag-chat/*`（对话、思维链、检索、引用、输入框）
- `app/(main)/explore/page.tsx`
- `app/(auth)/login/page.tsx`、`app/(auth)/register/page.tsx`
- `app/(main)/settings/providers/page.tsx`
- `components/chat-panel.tsx`、`components/agent-preview-chat.tsx`
- `components/ui/message-markdown.tsx` + `components/ui/markdown-components.tsx`（新增）

### 剩余 17 处是合法用法，不需要迁移

| 用法 | 出现位置 | 为什么保留 |
| --- | --- | --- |
| `bg-black/50`、`bg-black/80` | 模态遮罩层（Dialog / Sheet / AlertDialog） | 半透明蒙版，作用是压暗背景内容，与主题无关。Radix 默认即如此 |
| `text-white` | 图片浮层上的文件名、尺寸 | 压在深色蒙版之上，需要固定白色，不能随主题翻转 |

**检查命令**（应只剩这两类）：

```bash
grep -rhoE "\b(bg|text|border|ring)-(white|black|slate|gray|red|blue|green)-?[0-9]{0,3}\b" \
  frontend/app frontend/components --include="*.tsx" | sort | uniq -c
```

### Markdown 渲染器只有一份

`components/ui/markdown-components.tsx` 是**全站唯一**的 Markdown 渲染规则。
此前 `rag-chat/MessageItem` 和 `ui/message-markdown` 各写一套，同一段 Markdown
在 RAG 对话和 Agent 对话里长得不一样，改样式要改两处。

调用方只覆盖自己特有的部分，例如 `message-markdown` 覆盖 `pre` 以套上
带复制按钮的 `CodeBlock`：

```tsx
components={{ ...markdownComponents, pre: 自定义 }}
```

**新增对话界面时直接引用它，不要再抄一份。**

### 迁移时的检查方式

```bash
# 某个文件还剩多少硬编码颜色
grep -oE "\b(bg|text|border|ring|from|to|via)-(white|black|slate|gray|red|amber|green|emerald|blue|indigo)-?[0-9]{0,3}\b" <文件> | sort | uniq -c
```

映射不是纯机械替换——同一个蓝色可能是主按钮、链接或信息态，语义不同，
替换前要看上下文。

---

## 7. 已知坑

### 7.1 `react-markdown` v9 起移除了 `inline` 属性

代码里曾有：

```tsx
code: ({ inline, children }) => inline ? <行内样式/> : <块级样式/>
```

当前版本是 v10，`inline` **恒为 `undefined`**，这个分支从来没按预期工作过。
区分行内与块级请交给 CSS 选择器：`:not(pre) > code` 与 `pre > code`，
它们能真正区分，特异性也高于组件里的工具类。

### 7.2 用到表格必须显式启用 `remark-gfm`

`MessageItem` 曾定义了完整的 `table` / `th` / `td` 渲染器，但没有传
`remarkPlugins={[remarkGfm]}`，**Markdown 表格因此完全不渲染**，那些渲染器是死代码。
删除线、任务列表同理。

```tsx
<ReactMarkdown remarkPlugins={[remarkGfm]} components={...}>
```

### 7.3 全局 CSS 会盖过组件的工具类

`.react-markdown :not(pre) > code`（特异性 0,1,2）高于 Tailwind 的
`text-[13px]`（0,1,0）。在组件里写字号却不生效时，先查 `globals.css` 有没有更具体的选择器。

### 7.4 不要用关键词猜测「这是不是错误消息」

`MessageMarkdown` 曾这样判断：

```ts
const errorKeywords = ['错误', '失败', '无法', '未配置', '抱歉', ...]
return errorKeywords.some(k => content.includes(k))
```

结果是**任何正常回答只要提到这些词，整条就会被渲染成红色错误块**——
例如「如果连接失败，可以这样排查」。而且行内代码当时是 `!text-red-600`（红字），
两者叠加后满屏都在报警。

是不是错误只有发起调用的地方知道，必须由调用方显式传 `isError`。
`chat-panel` 本来就在流层面用 `isErrorMessage(data)` 判断并弹 toast、
early return，那条启发式规则从头到尾只起了误判作用。

### 7.5 不要一边跑 `pnpm dev` 一边跑 `pnpm build`

两者共用 `.next` 目录，`build` 会覆盖 dev server 的产物，页面随即报
`missing required error components, refreshing...`。重启 dev server 即可恢复。

---

## 相关文档

- [文档索引](../README.md) —— 全部文档入口
- [本地开发指南](local-setup.md) —— 环境搭建与提交流程
- [对话模块](../modules/conversation.md) —— 对话链路与消息协议
- [AGENTS.md](../../AGENTS.md) —— 工程规范与文档记录要求
