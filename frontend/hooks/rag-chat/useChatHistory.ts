import { useEffect, useCallback } from 'react';
import type { Message } from './useRagChatSession';

// 聊天历史的存储键前缀
const CHAT_HISTORY_PREFIX = 'rag_chat_history_';

// 获取存储键
const getChatHistoryKey = (datasetId: string) => `${CHAT_HISTORY_PREFIX}${datasetId}`;

// 保存聊天历史到 localStorage
export function saveChatHistory(datasetId: string, messages: Message[]) {
  try {
    const key = getChatHistoryKey(datasetId);
    const data = {
      messages,
      timestamp: Date.now(),
      datasetId
    };
    localStorage.setItem(key, JSON.stringify(data));
    console.log('[ChatHistory] Saved chat history for dataset:', datasetId, 'messages:', messages.length);
  } catch (error) {
    console.error('[ChatHistory] Failed to save chat history:', error);
  }
}

// 从 localStorage 加载聊天历史
export function loadChatHistory(datasetId: string): Message[] {
  try {
    const key = getChatHistoryKey(datasetId);
    const stored = localStorage.getItem(key);

    if (!stored) {
      console.log('[ChatHistory] No history found for dataset:', datasetId);
      return [];
    }

    const data = JSON.parse(stored);

    // 转换时间戳为 Date 对象
    const messages = data.messages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));

    console.log('[ChatHistory] Loaded chat history for dataset:', datasetId, 'messages:', messages.length);
    return messages;
  } catch (error) {
    console.error('[ChatHistory] Failed to load chat history:', error);
    return [];
  }
}

// 清除聊天历史
export function clearChatHistory(datasetId: string) {
  try {
    const key = getChatHistoryKey(datasetId);
    localStorage.removeItem(key);
    console.log('[ChatHistory] Cleared chat history for dataset:', datasetId);
  } catch (error) {
    console.error('[ChatHistory] Failed to clear chat history:', error);
  }
}

// Hook: 自动保存和加载聊天历史
export function useChatHistory(datasetId: string | undefined, messages: Message[]) {
  // 加载历史记录
  const loadHistory = useCallback(() => {
    if (!datasetId) return [];
    return loadChatHistory(datasetId);
  }, [datasetId]);

  // 保存历史记录
  const saveHistory = useCallback(() => {
    if (!datasetId) return;
    saveChatHistory(datasetId, messages);
  }, [datasetId, messages]);

  // 清除历史记录
  const clearHistory = useCallback(() => {
    if (!datasetId) return;
    clearChatHistory(datasetId);
  }, [datasetId]);

  // 自动保存：当消息变化时
  useEffect(() => {
    if (datasetId && messages.length > 0) {
      // 延迟保存，避免频繁写入
      const timeoutId = setTimeout(() => {
        saveHistory();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [datasetId, messages, saveHistory]);

  return {
    loadHistory,
    saveHistory,
    clearHistory
  };
}
