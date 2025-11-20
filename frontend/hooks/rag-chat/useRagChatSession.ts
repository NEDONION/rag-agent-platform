import { useCallback, useRef, useState, useEffect } from 'react';
import { RagChatSession } from '@/lib/rag-chat-service';
import type { RagStreamChatRequest, RagThinkingData } from '@/types/rag-dataset';
import { loadChatHistory, saveChatHistory, clearChatHistory } from './useChatHistory';

// 消息类型定义
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  retrieval?: RagThinkingData;
  thinking?: RagThinkingData;
  thinkingContent?: string;
  timestamp: Date;
  isStreaming?: boolean;
  isThinkingComplete?: boolean;
  isRetrievalComplete?: boolean;
}

interface UseRagChatSessionOptions {
  datasetId?: string; // 用于持久化的数据集ID
  onError?: (error: string) => void;
  onDone?: () => void;
}

export function useRagChatSession(options: UseRagChatSessionOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);

  // 初始化时从 localStorage 加载历史记录
  useEffect(() => {
    if (options.datasetId) {
      const history = loadChatHistory(options.datasetId);
      if (history.length > 0) {
        console.log('[useRagChatSession] Loaded chat history:', history.length, 'messages');
        setMessages(history);
      }
    }
  }, [options.datasetId]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentThinking, setCurrentThinking] = useState<RagThinkingData | null>(null);
  const [currentThinkingContent, setCurrentThinkingContent] = useState<string>('');
  
  const chatSessionRef = useRef<RagChatSession | null>(null);
  const thinkingContentRef = useRef<string>('');
  const processedTimestamps = useRef<Set<number>>(new Set());

  // 自动保存消息到 localStorage
  useEffect(() => {
    if (options.datasetId && messages.length > 0) {
      const timeoutId = setTimeout(() => {
        saveChatHistory(options.datasetId!, messages);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [options.datasetId, messages]);

  // 清空对话
  const clearMessages = useCallback(() => {
    if (chatSessionRef.current) {
      chatSessionRef.current.abort();
    }
    setMessages([]);
    setCurrentThinking(null);
    setCurrentThinkingContent('');
    thinkingContentRef.current = '';
    processedTimestamps.current.clear();
    setIsLoading(false);

    // 清除持久化的历史记录
    if (options.datasetId) {
      clearChatHistory(options.datasetId);
    }
  }, [options.datasetId]);

  // 停止生成
  const stopGeneration = useCallback(() => {
    if (chatSessionRef.current) {
      chatSessionRef.current.abort();
    }
    setIsLoading(false);
    setMessages(prev => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
        lastMessage.isStreaming = false;
        if (!lastMessage.content) {
          lastMessage.content = '生成已停止。';
        }
      }
      return newMessages;
    });
  }, []);

  // 发送消息
  const sendMessage = useCallback(async (question: string, datasetIds: string[]) => {
    if (!question.trim() || isLoading) return;

    // 创建用户消息
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date()
    };

    // 创建助手消息占位符
    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);
    setCurrentThinking(null);
    setCurrentThinkingContent('');
    thinkingContentRef.current = '';
    processedTimestamps.current.clear();

    // 确保聊天会话已初始化
    if (!chatSessionRef.current) {
      chatSessionRef.current = new RagChatSession();
    }

    // 如果有正在进行的会话，先中止
    if (chatSessionRef.current.isActive()) {
      chatSessionRef.current.abort();
    }

    try {
      await chatSessionRef.current.start(
        {
          datasetIds,
          question,
          stream: true
        },
        {
          onThinking: (data) => {
            setCurrentThinking(data);
            setMessages(prev => {
              if (prev.length > 0) {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  const updatedMessage = { ...lastMessage };
                  if (data.type === 'retrieval') {
                    updatedMessage.retrieval = data;
                    if (data.status === 'end') {
                      updatedMessage.isRetrievalComplete = true;
                    }
                  } else if (data.type === 'thinking' || data.type === 'answer') {
                    updatedMessage.thinking = data;
                  }
                  return [...prev.slice(0, -1), updatedMessage];
                }
              }
              return prev;
            });
          },
          onThinkingContent: (content, timestamp) => {
            thinkingContentRef.current += content;
            setCurrentThinkingContent(thinkingContentRef.current);
            
            setMessages(prev => {
              if (prev.length > 0) {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    {
                      ...lastMessage,
                      thinkingContent: thinkingContentRef.current
                    }
                  ];
                }
              }
              return prev;
            });
          },
          onThinkingEnd: () => {
            setMessages(prev => {
              if (prev.length > 0) {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    {
                      ...lastMessage,
                      isThinkingComplete: true
                    }
                  ];
                }
              }
              return prev;
            });
          },
          onContent: (content, timestamp) => {
            // 移除时间戳去重逻辑，避免内容丢失

            setMessages(prev => {
              if (prev.length > 0) {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    {
                      ...lastMessage,
                      content: lastMessage.content + content
                    }
                  ];
                }
              }
              return prev;
            });
          },
          onError: (error) => {
            options.onError?.(error);
            setMessages(prev => {
              if (prev.length > 0) {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    {
                      ...lastMessage,
                      content: '抱歉，处理您的请求时出现了错误。请重试。',
                      isStreaming: false
                    }
                  ];
                }
              }
              return prev;
            });
          },
          onDone: () => {
            setMessages(prev => {
              if (prev.length > 0) {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    {
                      ...lastMessage,
                      isStreaming: false
                    }
                  ];
                }
              }
              return prev;
            });
            options.onDone?.();
          }
        }
      );
    } catch (error) {
      console.error('Chat error:', error);
      options.onError?.(error instanceof Error ? error.message : '发送消息失败');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, options]);

  return {
    messages,
    isLoading,
    currentThinking,
    currentThinkingContent,
    sendMessage,
    clearMessages,
    stopGeneration
  };
}