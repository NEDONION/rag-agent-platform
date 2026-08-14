"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useCopy } from "@/hooks/use-copy";
import { CodeBlock } from "@/components/ui/code-block";
import { markdownComponents, StreamingCaret } from "@/components/ui/markdown-components";
import { cn } from "@/lib/utils";

interface MessageMarkdownProps {
  content: string;
  showCopyButton?: boolean;
  isStreaming?: boolean;
  /** 由调用方明确告知这是一条错误消息。
   *
   * 注意：此处**不再**根据文案内容猜测。原实现用关键词匹配
   * （"错误"/"失败"/"无法"/"抱歉"…）判断，导致任何正常回答只要提到这些词
   * 就被整条渲染成红色错误块——例如「如果连接失败，可以这样排查」。
   * 是不是错误只有发起调用的地方知道，必须显式传入。 */
  isError?: boolean;
  className?: string;
}

/** 预处理：把各种全角/花式引号归一成标准反引号，清掉零宽字符。
 *  模型偶尔会输出 ｀ 或 ‛ 之类，不归一会导致代码块识别失败。 */
const preprocessContent = (content: string): string => {
  if (!content) return content;
  return content
    .replace(/｀/g, "`")
    .replace(/['']([^'']*?)[''] /g, "`$1` ")
    .replace(/‛/g, "`")
    .replace(/′/g, "`")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
};

export function MessageMarkdown({
  content,
  showCopyButton = true,
  isStreaming = false,
  isError = false,
  className,
}: MessageMarkdownProps) {
  const { copyMarkdown } = useCopy();
  const processedContent = preprocessContent(content);

  if (isError) {
    return (
      <div className={cn("relative group min-w-0", className)}>
        <div className="whitespace-pre-wrap rounded-lg border border-destructive/30 p-3 text-sm text-foreground">
          {content}
          {isStreaming && <StreamingCaret />}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative group min-w-0 overflow-x-auto", className)}>
      <div className="react-markdown w-full min-w-0 text-sm leading-[1.7] text-foreground/90">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            ...markdownComponents,
            // 唯一的差异：代码块外面套一层带复制按钮的容器
            pre: ({ children, ...props }) => {
              const codeElement = children as React.ReactElement;
              const code =
                typeof codeElement?.props?.children === "string" ? codeElement.props.children : "";
              return (
                <CodeBlock code={code}>
                  <pre
                    className="my-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 first:mt-0 last:mb-0"
                    {...props}
                  >
                    {children}
                  </pre>
                </CodeBlock>
              );
            },
          }}
        >
          {processedContent}
        </ReactMarkdown>
        {isStreaming && <StreamingCaret />}
      </div>

      {showCopyButton && (
        <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyMarkdown(content)}
            className="h-6 w-6 rounded p-0"
            aria-label="复制消息"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
