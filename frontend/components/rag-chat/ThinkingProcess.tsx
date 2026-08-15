"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronRight, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { RagThinkingData } from "@/types/rag-dataset";

interface ThinkingProcessProps {
  thinking?: RagThinkingData;
  thinkingContent?: string;
  isThinkingComplete?: boolean;
  isStreaming?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

/** 思维链（CoT）展示。
 *
 * 设计取向：思考过程是**次要信息**，不该和答案抢视觉权重。因此不用卡片、不用强调色，
 * 只用一条左侧竖线 + 降级的文字颜色把它压到答案之下的层级；展开后内容与触发器对齐，
 * 靠缩进而非边框来表达从属关系。 */
export function ThinkingProcess({
  thinking,
  thinkingContent,
  isThinkingComplete,
  isStreaming,
  expanded = true,
  onToggle,
}: ThinkingProcessProps) {
  if (!thinking && !thinkingContent) {
    return null;
  }

  const inProgress = !isThinkingComplete && isStreaming;

  return (
    <Collapsible open={expanded} onOpenChange={onToggle} className="w-full">
      <CollapsibleTrigger className="group flex items-center gap-1.5 rounded-md py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90"
        />
        {inProgress ? (
          <>
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
            <span>正在思考</span>
          </>
        ) : (
          <span>思考过程</span>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        {/* 排版节奏由 globals.css 的 .is-compact 变体统一提供（12px / 1.55 行高 /
            压缩的段落与列表间距）。这里只负责层级：降级的文字颜色与从属缩进。 */}
        <div className="ml-[7px] border-l border-border pl-3 pt-0.5">
          {thinkingContent ? (
            <div className="react-markdown is-compact text-muted-foreground [&_ol]:list-decimal [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{thinkingContent}</ReactMarkdown>
            </div>
          ) : (
            <span className="text-[12px] text-muted-foreground">正在整理思路…</span>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
