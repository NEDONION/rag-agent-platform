"use client";

import type { Components } from "react-markdown";

/** 全站唯一的 Markdown 渲染规则。
 *
 * 背景：此前 `rag-chat/MessageItem` 与 `ui/message-markdown` 各写了一套，
 * 同一段 Markdown 在 RAG 对话和 Agent 对话里长得不一样，改样式要改两处。
 * 现在统一到这里，调用方只覆盖自己特有的部分（例如代码块的复制按钮）。
 *
 * 设计基准见 `docs/development/frontend-style.md`：
 * 正文 14px / 行高 1.7，标题只收敛到三档（16 / 15 / 14），颜色一律用令牌。 */
export const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-2 mt-6 text-base font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-6 text-[15px] font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-5 text-sm font-semibold text-foreground first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1.5 mt-4 text-sm font-medium text-foreground first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mb-1 mt-3 text-sm font-medium text-foreground first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="mb-1 mt-3 text-sm font-medium text-muted-foreground first:mt-0">{children}</h6>
  ),

  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,

  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1 pl-5 marker:text-muted-foreground first:mt-0 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1 pl-5 marker:text-muted-foreground first:mt-0 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,

  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,

  // react-markdown v9 起已移除 `inline` 属性（v10 中恒为 undefined），
  // 行内与块级的区分交给 globals.css 的 `:not(pre) > code` / `pre > code`。
  code: ({ children, ...props }) => (
    <code className="font-mono" {...props}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 first:mt-0 last:mb-0">
      {children}
    </pre>
  ),

  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-border pl-4 text-muted-foreground first:mt-0 last:mb-0">
      {children}
    </blockquote>
  ),

  a: ({ children, href }) => (
    <a
      href={href}
      className="font-medium text-foreground underline decoration-muted-foreground/40 underline-offset-[3px] transition-colors hover:decoration-foreground"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),

  hr: () => <hr className="my-6 border-border" />,

  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border first:mt-0 last:mb-0">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-medium text-foreground">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 align-top">{children}</td>,
};

/** 流式输出时的光标 */
export function StreamingCaret() {
  return (
    <span
      className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] animate-pulse rounded-full bg-foreground"
      aria-hidden
    />
  );
}
