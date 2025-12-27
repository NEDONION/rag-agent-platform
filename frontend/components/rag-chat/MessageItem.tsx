"use client";

import ReactMarkdown from "react-markdown";
import { Bot, User, Loader2, Bookmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RetrievalProcess } from "./RetrievalProcess";
import { ThinkingProcess } from "./ThinkingProcess";
import type { Message } from '@/hooks/rag-chat/useRagChatSession';
import type { RetrievedFileInfo } from '@/types/rag-dataset';

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
  onToggleThinking
}: MessageItemProps) {
  console.log('[MessageItem] Rendering message:', {
    id: message.id,
    role: message.role,
    content: message.content,
    isStreaming: message.isStreaming
  });
  return (
    <div
      className={`flex gap-3 ${
        message.role === 'user' ? 'justify-end' : 'justify-start'
      }`}
    >
      {message.role === 'assistant' && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
      )}
      
      <div className={`flex flex-col gap-2 max-w-[96%] ${
        message.role === 'user' ? 'items-end' : 'items-start'
      }`}>
        {/* 用户消息 */}
        {message.role === 'user' && (
          <Card className="px-4 py-2 bg-blue-600 text-white shadow-sm rounded-2xl rounded-br-md">
            <div className="text-sm whitespace-pre-wrap">
              {message.content}
            </div>
          </Card>
        )}
        
        {/* 助手消息：检索过程 */}
        {message.role === 'assistant' && message.retrieval && (
          <RetrievalProcess
            retrieval={message.retrieval}
            onFileClick={onFileClick}
            selectedFileId={selectedFileId}
          />
        )}
        
        {/* 助手消息：思考过程 */}
        {message.role === 'assistant' && (message.thinking || message.thinkingContent) && (
          <ThinkingProcess
            thinking={message.thinking}
            thinkingContent={message.thinkingContent}
            isThinkingComplete={message.isThinkingComplete}
            isStreaming={message.isStreaming}
            expanded={expandedThinking}
            onToggle={onToggleThinking}
          />
        )}
        
        {/* 助手消息：回答内容 */}
        {message.role === 'assistant' && message.content && (
          <Card
            className="px-4 py-3 bg-white border border-slate-200 shadow-sm rounded-2xl rounded-bl-md"
            key={`${message.id}-content`}
          >
            <div className="prose prose-slate max-w-none text-[11px] leading-relaxed">
              <ReactMarkdown
                components={{
                  // 标题元素
                  h1: ({ children }) => <h1 className="text-2xl font-bold mt-4 mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-semibold mt-4 mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-medium mt-3 mb-2">{children}</h3>,
                  h4: ({ children }) => <h4 className="text-base font-medium mt-2 mb-2">{children}</h4>,
                  h5: ({ children }) => <h5 className="text-sm font-medium my-1">{children}</h5>,
                  h6: ({ children }) => <h6 className="text-xs font-medium my-1">{children}</h6>,

                  // 段落和文本
                  p: ({ children }) => <p className="my-2 leading-relaxed text-slate-700">{children}</p>,

                  // 列表
                  ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1 text-slate-700">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1 text-slate-700">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

                  // 文本样式
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,

                  // 代码块
                  code: ({ inline, children, ...props }: any) => {
                    return inline ? (
                      <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-slate-100 p-3 rounded text-sm font-mono overflow-x-auto my-2" {...props}>
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,

                  // 引用
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-slate-300 pl-4 italic my-2 text-slate-600">
                      {children}
                    </blockquote>
                  ),

                  // 链接
                  a: ({ children, href }) => (
                    <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),

                  // 分隔线
                  hr: () => <hr className="my-4 border-slate-200" />,

                  // 表格
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="border-collapse border border-slate-200 w-full">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
                  tbody: ({ children }) => <tbody>{children}</tbody>,
                  tr: ({ children }) => <tr className="border-b border-slate-200">{children}</tr>,
                  th: ({ children }) => (
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-slate-200 px-3 py-2">
                      {children}
                    </td>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse" />
              )}
            </div>
          </Card>
        )}

        {message.role === 'assistant' && message.content && message.retrieval?.documents?.length ? (
          (() => {
            const deduped = new Map<string, RetrievedFileInfo>();
            message.retrieval.documents.forEach((doc) => {
              const key = `${doc.fileId}-${doc.page ?? "na"}`;
              const existing = deduped.get(key);
              if (!existing || (doc.score ?? 0) > (existing.score ?? 0)) {
                deduped.set(key, doc);
              }
            });
            const citations = Array.from(deduped.values())
              .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
              .slice(0, 6);

            return (
              <Card className="px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-[11px]">
                <div className="flex items-center gap-2 text-[12px] font-medium text-slate-700">
                  <Bookmark className="h-4 w-4" />
                  引用来源
                </div>
                <div className="mt-3 grid gap-2">
                  {citations.map((doc, index) => (
                    <div
                      key={`${doc.fileId}-${doc.page ?? index}`}
                      className="rounded-xl border border-indigo-200 px-3 py-2 text-sm bg-white"
                    >
                      <div className="font-medium text-slate-800 truncate">{doc.fileName}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span>来源：知识库文档</span>
                        {typeof doc.page === "number" && <span>页码：{doc.page}</span>}
                        {typeof doc.score === "number" && (
                          <Badge variant="outline" className="text-xs">
                            相似度 {(doc.score * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                      {doc.snippet && (
                        <div className="mt-2 text-xs text-slate-600 line-clamp-3">
                          {doc.snippet}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()
        ) : null}
        
        {/* 正在生成回答的提示 */}
        {message.role === 'assistant' && 
         message.isStreaming && 
         !message.content && 
         !message.retrieval && 
         !message.thinking && (
          <Card className="px-4 py-2 bg-muted">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>正在生成回答...</span>
            </div>
          </Card>
        )}
        
        <span className="text-xs text-muted-foreground px-2">
          {message.timestamp.toLocaleTimeString('zh-CN')}
        </span>
      </div>
      
      {message.role === 'user' && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
          <User className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}
