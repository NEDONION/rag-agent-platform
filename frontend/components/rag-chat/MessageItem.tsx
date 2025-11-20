"use client";

import ReactMarkdown from "react-markdown";
import { Bot, User, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
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
      
      <div className={`flex flex-col gap-2 max-w-[85%] ${
        message.role === 'user' ? 'items-end' : 'items-start'
      }`}>
        {/* 用户消息 */}
        {message.role === 'user' && (
          <Card className="px-4 py-2 bg-primary text-primary-foreground">
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
          <Card className="px-4 py-2 bg-muted" key={`${message.id}-content`}>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  // 标题元素
                  h1: ({ children }) => <h1 className="text-2xl font-bold my-4">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-semibold my-3">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-medium my-2">{children}</h3>,
                  h4: ({ children }) => <h4 className="text-base font-medium my-2">{children}</h4>,
                  h5: ({ children }) => <h5 className="text-sm font-medium my-1">{children}</h5>,
                  h6: ({ children }) => <h6 className="text-xs font-medium my-1">{children}</h6>,

                  // 段落和文本
                  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,

                  // 列表
                  ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

                  // 文本样式
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,

                  // 代码块
                  code: ({ inline, children, ...props }: any) => {
                    return inline ? (
                      <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm font-mono overflow-x-auto my-2" {...props}>
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,

                  // 引用
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-gray-300 dark:border-gray-700 pl-4 italic my-2">
                      {children}
                    </blockquote>
                  ),

                  // 链接
                  a: ({ children, href }) => (
                    <a href={href} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),

                  // 分隔线
                  hr: () => <hr className="my-4 border-gray-200 dark:border-gray-700" />,

                  // 表格
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="border-collapse border border-gray-300 dark:border-gray-700 w-full">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>,
                  tbody: ({ children }) => <tbody>{children}</tbody>,
                  tr: ({ children }) => <tr className="border-b border-gray-200 dark:border-gray-700">{children}</tr>,
                  th: ({ children }) => (
                    <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left font-semibold">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-gray-300 dark:border-gray-700 px-3 py-2">
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