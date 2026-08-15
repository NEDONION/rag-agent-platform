"use client";

import { FileSearch, Loader2 } from "lucide-react";
import { ClickableFileLink } from "./ClickableFileLink";
import type { RagThinkingData, RetrievedFileInfo } from "@/types/rag-dataset";

interface RetrievalProcessProps {
  retrieval: RagThinkingData;
  onFileClick?: (file: RetrievedFileInfo) => void;
  selectedFileId?: string;
}

/** 检索过程展示。与 ThinkingProcess 同属「过程信息」，因此保持同一视觉层级：
 * 中性色、无卡片、靠一条左侧竖线表达从属，不与答案争夺注意力。 */
export function RetrievalProcess({ retrieval, onFileClick, selectedFileId }: RetrievalProcessProps) {
  if (!retrieval || retrieval.type !== "retrieval") {
    return null;
  }

  const done = retrieval.status === "end";

  // 按 fileId 去重，保留每个文件的最高分文档
  const uniqueFiles = (retrieval.documents ?? [])
    .reduce<NonNullable<RagThinkingData["documents"]>>((acc, doc) => {
      const existing = acc.find((item) => item.fileId === doc.fileId);
      if (!existing) {
        acc.push(doc);
      } else if (doc.score > existing.score) {
        acc[acc.indexOf(existing)] = doc;
      }
      return acc;
    }, [])
    .sort((a, b) => b.score - a.score);

  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
        {done ? (
          <FileSearch className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        )}
        <span>
          {retrieval.status === "start" && "检索文档"}
          {retrieval.status === "progress" && "正在检索"}
          {done &&
            (uniqueFiles.length > 0 ? `检索到 ${uniqueFiles.length} 篇文档` : "未检索到相关文档")}
        </span>
      </div>

      {uniqueFiles.length > 0 && (
        <div className="ml-[7px] space-y-0.5 border-l border-border pl-3 pt-0.5">
          {uniqueFiles.map((doc, idx) => (
            <ClickableFileLink
              key={`${doc.fileId}-${idx}`}
              file={doc}
              onClick={onFileClick}
              isSelected={selectedFileId === doc.fileId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
