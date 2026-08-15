"use client";

import { useRef, useState } from "react";
import { ArrowUp, Square, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputAreaProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  onClear?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  hasMessages?: boolean;
  className?: string;
}

const MAX_HEIGHT = 200;

export function ChatInputArea({
  onSend,
  onStop,
  onClear,
  isLoading = false,
  disabled = false,
  hasMessages = false,
  className,
}: ChatInputAreaProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = input.trim().length > 0 && !isLoading && !disabled;

  const handleSend = () => {
    if (!canSend) return;
    onSend(input.trim());
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 随内容增高，到上限后转为内部滚动
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  return (
    <div className={cn("border-t border-border bg-card", className)}>
      <div className="mx-auto w-full max-w-3xl px-4 py-3">
        {/* 整个 composer 是一个表面：输入区与操作按钮共处同一个边框内，
            焦点环加在容器上而非 textarea 上，避免出现「框中框」。 */}
        <div
          className={cn(
            "rounded-xl border border-border bg-background transition-shadow",
            focused && "ring-1 ring-foreground/15"
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="输入问题，Enter 发送"
            rows={1}
            disabled={isLoading || disabled}
            className="block max-h-[200px] w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-sm leading-[1.7] text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />

          <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
            <div className="flex items-center">
              {hasMessages && (
                <button
                  type="button"
                  onClick={onClear}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  清空
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Shift + Enter 换行
              </span>
              {isLoading ? (
                <button
                  type="button"
                  onClick={onStop}
                  title="停止生成"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent"
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  title="发送"
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                    canSend
                      ? "bg-foreground text-background hover:opacity-90"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
