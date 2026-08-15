"use client";

import { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ChatLayout } from '@/types/rag-dataset';

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  layout: ChatLayout;
  className?: string;
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  children,
  layout,
  className
}: ResponsiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // 遮罩层原本是 bg-transparent，等于没有遮罩：白色弹窗浮在白色页面上，
        // 没有任何边界，用户看不出「打开了一个窗口」。这里压暗背景并轻微模糊，
        // 让弹窗从页面里"浮"出来。
        overlayClassName="bg-foreground/25 backdrop-blur-[2px]"
        className={cn(
          // 描边 + 投影是弹窗与页面的分界线，不能省
          "flex flex-col overflow-hidden rounded-xl border border-border bg-card p-0 shadow-2xl",
          layout === 'single'
            ? "max-w-6xl h-[88vh]"
            : "max-w-7xl h-[90vh]",
          className
        )}
      >
        <DialogHeader className="flex-shrink-0 border-b border-border bg-card px-5 py-3.5">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
