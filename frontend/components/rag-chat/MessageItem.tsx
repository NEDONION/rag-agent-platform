"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Loader2 } from "lucide-react";
import { markdownComponents, StreamingCaret } from "@/components/ui/markdown-components";
import { RetrievalProcess } from "./RetrievalProcess";
import { ThinkingProcess } from "./ThinkingProcess";
import type { Message } from "@/hooks/rag-chat/useRagChatSession";
import type { RetrievedFileInfo } from "@/types/rag-dataset";

interface MessageItemProps {
  message: Message;
  onFileClick?: (file: RetrievedFileInfo) => void;
  selectedFileId?: string;
  expandedThinking?: boolean;
  onToggleThinking?: () => void;
}


export function MessageItem({
  message,
  onFileClick,
  selectedFileId,
  expandedThinking = true,
  onToggleThinking,
}: MessageItemProps) {
  const isUser = message.role === "user";

  // 用户消息：靠右的淡蓝气泡。用 accent 而非 muted——消息区地面本身就是
  // muted 系，同色气泡会与地面糊在一起，看不出这是一条消息。
  if (isUser) {
    return (
      <div className="group flex justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-1">
          <div className="rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-sm leading-[1.7] text-accent-foreground">
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
          <time className="px-1 text-[11px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {message.timestamp.toLocaleTimeString("zh-CN")}
          </time>
        </div>
      </div>
    );
  }

  const citations = (() => {
    const docs = message.retrieval?.documents;
    if (!message.content || !docs?.length) return [];
    const deduped = new Map<string, RetrievedFileInfo>();
    docs.forEach((doc) => {
      const key = `${doc.fileId}-${doc.page ?? "na"}`;
      const existing = deduped.get(key);
      if (!existing || (doc.score ?? 0) > (existing.score ?? 0)) {
        deduped.set(key, doc);
      }
    });
    return Array.from(deduped.values())
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 6);
  })();

  const showPendingHint =
    message.isStreaming && !message.content && !message.retrieval && !message.thinking;

  return (
    <div className="group flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-accent/40">
        <Bot className="h-3.5 w-3.5 text-primary" />
      </div>

      {/* 助手内容用白色卡片浮在淡蓝灰地面上。
          此前是平铺无边框，配合同为白色的页面底，整个对话区糊成一片，
          用户反馈「完全看不出这是对话窗口」。卡片内部的标题/列表/表格层级不受影响。 */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
        {message.retrieval && (
          <RetrievalProcess
            retrieval={message.retrieval}
            onFileClick={onFileClick}
            selectedFileId={selectedFileId}
          />
        )}

        {(message.thinking || message.thinkingContent) && (
          <ThinkingProcess
            thinking={message.thinking}
            thinkingContent={message.thinkingContent}
            isThinkingComplete={message.isThinkingComplete}
            isStreaming={message.isStreaming}
            expanded={expandedThinking}
            onToggle={onToggleThinking}
          />
        )}

        {message.content && (
          <div className="react-markdown rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm leading-[1.7] text-foreground/90">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && <StreamingCaret />}
          </div>
        )}

        {citations.length > 0 && (
          <div className="mt-1 rounded-lg border border-border">
            <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
              引用来源
            </div>
            <ol className="divide-y divide-border">
              {citations.map((doc, index) => (
                <li
                  key={`${doc.fileId}-${doc.page ?? index}`}
                  className="flex gap-2.5 px-3 py-2.5 text-[13px]"
                >
                  <span className="mt-[1px] shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{doc.fileName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
                      {typeof doc.page === "number" && <span>第 {doc.page} 页</span>}
                      {typeof doc.score === "number" && (
                        <span className="tabular-nums">相似度 {(doc.score * 100).toFixed(0)}%</span>
                      )}
                    </div>
                    {doc.snippet && (
                      <p className="mt-1.5 line-clamp-2 text-[12px] leading-[1.6] text-muted-foreground">
                        {doc.snippet}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {showPendingHint && (
          <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>正在生成回答</span>
          </div>
        )}

        <time className="text-[11px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {message.timestamp.toLocaleTimeString("zh-CN")}
        </time>
      </div>
    </div>
  );
}
