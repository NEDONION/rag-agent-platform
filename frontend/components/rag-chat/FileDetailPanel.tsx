"use client";

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownComponents } from '@/components/ui/markdown-components';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertCircle, 
  FileText, 
  Calendar, 
  HardDrive, 
  Hash, 
  Search, 
  X,
  Loader2,
  FileSearch,
  CheckCircle
} from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getFileInfoWithToast, getDocumentUnitsWithToast } from '@/lib/rag-file-service';
import { getInstalledRagFileDocumentsWithToast, getInstalledRagFileInfoWithToast } from '@/lib/rag-publish-service';
import { useFileDetail } from '@/hooks/rag-chat/useFileDetail';
import type { 
  RetrievedFileInfo, 
  FileDetailInfoDTO, 
  DocumentUnitDTO, 
  PageResponse 
} from '@/types/rag-dataset';

interface FileDetailPanelProps {
  selectedFile: RetrievedFileInfo | null;
  onDataLoad?: (data: any) => void;
}

export function FileDetailPanel({ selectedFile, onDataLoad }: FileDetailPanelProps) {
  const [fileInfo, setFileInfo] = useState<FileDetailInfoDTO | null>(null);
  const [documentUnits, setDocumentUnits] = useState<DocumentUnitDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { formatFileSize } = useFileDetail();

  // 分页状态
  const [pageData, setPageData] = useState<PageResponse<DocumentUnitDTO>>({
    records: [],
    total: 0,
    size: 10, // RAG对话中使用较小的分页大小
    current: 1,
    pages: 0
  });

  // 防抖处理搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 加载文件信息和文档单元
  useEffect(() => {
    if (selectedFile) {
      loadFileInfo();
      loadDocumentUnits(1, debouncedQuery);
    } else {
      setFileInfo(null);
      setDocumentUnits([]);
      setError(null);
    }
  }, [selectedFile, debouncedQuery]);

  // 加载文件信息
  const loadFileInfo = async () => {
    if (!selectedFile) return;
    
    
    // 对于已安装RAG的文件，调用专门的API获取文件信息
    if (selectedFile.isInstalledRag && selectedFile.userRagId) {
      
      try {
        const response = await getInstalledRagFileInfoWithToast(selectedFile.userRagId, selectedFile.fileId);
        
        if (response.code === 200 && response.data) {
          // 使用从API获取的实际文件信息
          const installedFileInfo: FileDetailInfoDTO = {
            id: selectedFile.fileId,
            originalFilename: selectedFile.fileName,
            filename: selectedFile.fileName,
            url: response.data.url || selectedFile.filePath || '',
            size: response.data.size || 0, // 使用API返回的文件大小
            ext: response.data.ext || '',
            contentType: response.data.contentType || '',
            filePageSize: response.data.filePageSize || 0, // 使用API返回的页数信息
            isInitialize: response.data.processingStatus === 2 ? 1 : 0,
            isEmbedding: response.data.processingStatus === 2 ? 1 : 0,
            dataSetId: selectedFile.userRagId,
            userId: response.data.userId || '',
            createdAt: response.data.createdAt || '',
            updatedAt: response.data.updatedAt || ''
          };
          
          setFileInfo(installedFileInfo);
          onDataLoad?.(installedFileInfo);
          return;
        } else {
          throw new Error(response.message || '获取文件信息失败');
        }
      } catch (error) {
        console.error('[FileDetailPanel] Failed to load installed RAG file info:', error);
        // 如果API调用失败，仍然显示基本信息
        const fallbackFileInfo: FileDetailInfoDTO = {
          id: selectedFile.fileId,
          originalFilename: selectedFile.fileName,
          filename: selectedFile.fileName,
          url: selectedFile.filePath || '',
          size: 0,
          ext: '',
          contentType: '',
          filePageSize: 0,
          isInitialize: 1,
          isEmbedding: 1,
          dataSetId: selectedFile.userRagId,
          userId: '',
          createdAt: '',
          updatedAt: ''
        };
        
        setFileInfo(fallbackFileInfo);
        onDataLoad?.(fallbackFileInfo);
        return;
      }
    }
    
    try {
      const response = await getFileInfoWithToast(selectedFile.fileId);
      if (response.code === 200) {
        setFileInfo(response.data);
        onDataLoad?.(response.data);
      } else {
        setError(response.message || '获取文件信息失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取文件信息失败';
      setError(errorMessage);
      console.error('获取文件信息失败:', err);
    }
  };

  // 加载文档单元列表
  const loadDocumentUnits = async (page: number = 1, keyword?: string) => {
    if (!selectedFile) return;
    
    try {
      setLoading(true);
      setError(null);
      
      let response;
      
      if (selectedFile.isInstalledRag && selectedFile.userRagId) {
        // 已安装RAG：使用快照感知API
        const documentsResponse = await getInstalledRagFileDocumentsWithToast(
          selectedFile.userRagId, 
          selectedFile.fileId
        );
        
        if (documentsResponse.code === 200) {
          let documents = documentsResponse.data || [];
          
          // 客户端过滤（如果有搜索查询）
          if (keyword?.trim()) {
            const query = keyword.trim().toLowerCase();
            documents = documents.filter(doc => 
              doc.content?.toLowerCase().includes(query)
            );
          }
          
          // 客户端分页
          const startIndex = (page - 1) * 10;
          const endIndex = startIndex + 10;
          const paginatedDocs = documents.slice(startIndex, endIndex);
          
          // 构造分页响应格式
          response = {
            code: 200,
            data: {
              records: paginatedDocs,
              total: documents.length,
              size: 10,
              current: page,
              pages: Math.ceil(documents.length / 10)
            }
          };
        } else {
          response = documentsResponse;
        }
      } else {
        // 原始RAG：使用原有API
        response = await getDocumentUnitsWithToast({
          fileId: selectedFile.fileId,
          page,
          pageSize: 10,
          keyword: keyword?.trim() || undefined
        });
      }
      
      if (response.code === 200) {
        setPageData(response.data);
        setDocumentUnits(response.data.records || []);
      } else {
        setError(response.message || '获取文档单元失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取文档单元失败';
      setError(errorMessage);
      console.error('获取文档单元失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 分页处理
  const handlePageChange = (page: number) => {
    if (page < 1 || page > pageData.pages) return;
    loadDocumentUnits(page, debouncedQuery);
  };

  // 生成分页数字
  const generatePageNumbers = () => {
    const pages: (number | string)[] = [];
    const current = pageData.current;
    const total = pageData.pages;

    if (total <= 5) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(total);
      } else if (current >= total - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = total - 3; i <= total; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(current - 1);
        pages.push(current);
        pages.push(current + 1);
        pages.push('...');
        pages.push(total);
      }
    }

    return pages;
  };

  if (!selectedFile) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>请选择一个文件查看详情</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 头部信息 */}
      <div className="shrink-0 border-b border-border bg-card p-4">
        <div className="space-y-3">
          <div className="flex items-start gap-2.5">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-foreground" title={selectedFile.fileName}>
                {selectedFile.fileName}
              </h3>
              {/* 元信息合并成一行，用间隔点分隔。原本「页数/大小」占一个两列网格、
                  「共 N 个语料」另起一行徽章，三项信息占了三行高度。 */}
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
                {selectedFile.score !== undefined && (
                  <span className="tabular-nums">相似度 {(selectedFile.score * 100).toFixed(0)}%</span>
                )}
                {fileInfo?.filePageSize ? (
                  <>
                    <span className="text-border">·</span>
                    <span className="tabular-nums">{fileInfo.filePageSize} 页</span>
                  </>
                ) : null}
                {fileInfo?.size ? (
                  <>
                    <span className="text-border">·</span>
                    <span className="tabular-nums">{formatFileSize(fileInfo.size)}</span>
                  </>
                ) : null}
                <span className="text-border">·</span>
                <span className="tabular-nums">{pageData.total} 个语料</span>
                {pageData.pages > 1 && (
                  <>
                    <span className="text-border">·</span>
                    <span className="tabular-nums">第 {pageData.current}/{pageData.pages} 页</span>
                  </>
                )}
                {selectedFile.isInstalledRag && (
                  <>
                    <span className="text-border">·</span>
                    <span>已安装知识库</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="搜索语料内容..."
              className="pl-10 pr-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-20 w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : documentUnits.length === 0 ? (
          <div className="text-center py-8">
            <FileSearch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? "未找到匹配的语料" : "暂无语料数据"}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery ? "尝试使用不同的搜索词" : "请先对文件进行初始化处理"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {documentUnits.map((unit) => (
              <Card key={unit.id} className="border-border p-3.5 shadow-none">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {/* 三个徽章是同一类元信息，用同一种权重。
                          原本「已向量化」是实心主色、其余是描边/次级，
                          视觉上像在强调它，但它只是一个状态而已。 */}
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                        第 {unit.page + 1} 页
                      </span>
                      {unit.isVector && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-success-subtle px-1.5 py-0.5 text-[10px] font-medium text-success">
                          <CheckCircle className="h-2.5 w-2.5" />
                          已向量化
                        </span>
                      )}
                      {unit.isOcr && (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          OCR
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 语料正文：使用全站共享的 Markdown 配置 + 紧凑变体。
                      此处原本内联了第三份渲染规则（全部 leading-tight、无 remark-gfm、
                      暗色下 dark:bg-foreground 是近白底），标题列表被压成一片纯文本。 */}
                  <div className="react-markdown is-compact text-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {unit.content}
                    </ReactMarkdown>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      ID: {unit.id.substring(0, 8)}...
                    </span>
                    <span className="text-xs text-muted-foreground">
                      更新: {new Date(unit.updatedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* 分页 */}
      {pageData.pages > 1 && (
        <div className="p-4 border-t shrink-0">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => handlePageChange(pageData.current - 1)}
                  className={pageData.current <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {generatePageNumbers().map((page, index) => (
                <PaginationItem key={index}>
                  {page === '...' ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      onClick={() => handlePageChange(page as number)}
                      isActive={page === pageData.current}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => handlePageChange(pageData.current + 1)}
                  className={pageData.current >= pageData.pages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}