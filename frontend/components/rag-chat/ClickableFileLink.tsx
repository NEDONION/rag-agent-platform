"use client";

import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RetrievedFileInfo } from "@/types/rag-dataset";

interface ClickableFileLinkProps {
  file: RetrievedFileInfo;
  onClick?: (file: RetrievedFileInfo) => void;
  isSelected?: boolean;
  className?: string;
}

/** 检索命中的文件条目。
 *
 * 这里刻意不用带边框的按钮：它出现在「检索过程」的竖线之内，是过程信息的子项。
 * 每条都套一个方框会在一屏里堆出大量描边，反而看不清结构。改为一行式条目 +
 * hover 背景反馈，选中态用左侧色条标记，比整框变色更安静也更容易扫读。 */
export function ClickableFileLink({
  file,
  onClick,
  isSelected = false,
  className,
}: ClickableFileLinkProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(file)}
      title={file.fileName}
      className={cn(
        "group/file relative flex w-full items-center gap-2 rounded-md py-1.5 pl-2.5 pr-2 text-left transition-colors",
        "hover:bg-accent",
        isSelected && "bg-accent",
        className
      )}
    >
      {isSelected && (
        <span className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-foreground" aria-hidden />
      )}
      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{file.fileName}</span>
      <span className="flex shrink-0 items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
        {typeof file.page === "number" && <span>p.{file.page}</span>}
        {typeof file.score === "number" && <span>{(file.score * 100).toFixed(0)}%</span>}
      </span>
    </button>
  );
}
