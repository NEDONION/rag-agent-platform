"use client";

/* 对话组件样式预览页。
 *
 * 用假数据渲染 MessageItem / ThinkingProcess / RetrievalProcess / ChatInputArea，
 * 便于在**不启动后端**的情况下检查排版、暗色模式和流式态。改这几个组件的样式时，
 * 打开 /dev-preview/chat 就能立刻看到全部状态，比造一次真实对话快得多。
 *
 * 仅开发环境可访问：生产构建下直接 404，避免把演示数据暴露出去。 */

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageItem } from "@/components/rag-chat/MessageItem";
import { ChatInputArea } from "@/components/rag-chat/ChatInputArea";
import type { Message } from "@/hooks/rag-chat/useRagChatSession";

const LONG_ANSWER = `向量检索的召回率受三个因素影响，按影响程度排序如下。

## 1. 嵌入模型的语义对齐度

**最关键的一环。** 如果 query 和文档用了不同的嵌入模型，或者模型没有在同领域语料上训练过，向量空间根本不对齐，后面调什么参数都没用。

常见的错误组合：

- query 用 \`text-embedding-3-small\`，文档用 \`bge-large-zh\`
- 中文文档用纯英文语料训练的模型
- 代码检索用通用文本模型

## 2. 分块策略

分块太大，一个 chunk 里混了多个主题，向量被"平均"掉；分块太小，上下文不足，语义不完整。

| 内容类型 | 建议 chunk size | overlap |
| --- | --- | --- |
| 技术文档 | 512 tokens | 50 |
| 法律条文 | 256 tokens | 30 |
| 对话记录 | 按轮次切 | 1 轮 |

> 经验值只是起点。真正该做的是拿自己的数据跑一遍召回评测。

## 3. 相似度阈值

阈值设太高会漏召回。平台里做了降级策略：

\`\`\`java
if (results.isEmpty() && threshold > MIN_THRESHOLD) {
    threshold -= STEP;
    results = retry(query, threshold);
}
\`\`\`

阈值本身不是越高越好，它和 embedding 模型的分布强相关——换模型就要重新标定。

相关配置见 \`application.yml\` 的 \`embedding.vector-store\` 段。`;

const THINKING = `用户问的是召回率低的原因，这是个诊断类问题，不是概念解释。

我应该先判断他处在哪个阶段：
1. 刚搭起来就召回差 → 大概率是模型或分块问题
2. 之前正常最近变差 → 大概率是数据或阈值漂移

从提问方式看没有提到"最近"，倾向于第一种。那就按影响程度从大到小讲，先说嵌入模型对齐，再说分块，最后说阈值。

注意不要一上来就讲调参，那是最表层的因素，容易误导他在错误的地方浪费时间。`;

const now = new Date();

const MESSAGES: Message[] = [
  {
    id: "u1",
    role: "user",
    content: "我的 RAG 召回率很低，检索出来的文档经常不相关，可能是什么原因？",
    timestamp: now,
  },
  {
    id: "a1",
    role: "assistant",
    content: LONG_ANSWER,
    thinkingContent: THINKING,
    isThinkingComplete: true,
    timestamp: now,
    retrieval: {
      type: "retrieval",
      status: "end",
      retrievedCount: 4,
      documents: [
        {
          fileId: "f1",
          fileName: "RAG 检索优化实践指南.pdf",
          documentId: "d1",
          score: 0.9123,
          snippet:
            "召回率的首要影响因素是嵌入模型与业务语料的对齐程度。若 query 与文档使用了不同的嵌入模型，向量空间不对齐，后续任何参数调整都难以奏效。",
        },
        {
          fileId: "f2",
          fileName: "向量数据库选型与分块策略.md",
          documentId: "d2",
          score: 0.8471,
          page: 12,
          snippet:
            "分块过大会导致单个 chunk 混合多个主题，向量表示被平均化；分块过小则上下文不足。建议技术文档使用 512 tokens、50 overlap 作为起点。",
        },
        {
          fileId: "f3",
          fileName: "相似度阈值标定方法.docx",
          documentId: "d3",
          score: 0.7218,
          page: 3,
          snippet: "阈值与 embedding 模型的分布强相关，更换模型后必须重新标定。",
        },
      ],
    },
  },
  {
    id: "u2",
    role: "user",
    content: "那分块大小具体怎么定？",
    timestamp: now,
  },
  {
    id: "a2",
    role: "assistant",
    content: "",
    isStreaming: true,
    thinkingContent: "用户追问分块大小。这次要给可操作的方法，而不是再列一遍经验值……",
    isThinkingComplete: false,
    timestamp: now,
  },
];

/** 生产环境直接 404。守卫放在外层组件里，避免在 hooks 之前做条件式提前返回
 *  （那会让生产与开发的 hook 调用顺序不一致，违反 rules of hooks）。 */
export default function ChatPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <ChatPreview />;
}

function ChatPreview() {
  const [dark, setDark] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // 与应用里 next-themes 的行为一致：class 打在 <html> 上，body 背景才会跟着变
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div>
      <div className="min-h-screen bg-background text-foreground">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
          <span className="text-sm font-medium">对话组件预览</span>
          <button
            onClick={() => setDark((v) => !v)}
            className="rounded-md border border-border px-3 py-1 text-xs hover:bg-accent"
          >
            {dark ? "切到亮色" : "切到暗色"}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md border border-border px-3 py-1 text-xs hover:bg-accent"
          >
            {expanded ? "收起思考过程" : "展开思考过程"}
          </button>
        </div>

        <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
          {MESSAGES.map((m) => (
            <MessageItem
              key={m.id}
              message={m}
              expandedThinking={expanded}
              onToggleThinking={() => setExpanded((v) => !v)}
            />
          ))}
        </div>

        <div className="sticky bottom-0 bg-background">
          <ChatInputArea onSend={() => {}} hasMessages />
        </div>
      </div>
    </div>
  );
}
