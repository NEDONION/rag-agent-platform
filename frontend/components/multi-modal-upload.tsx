"use client"

import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Paperclip, X } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { uploadMultipleFiles, type UploadResult, type UploadFileInfo } from '@/lib/file-upload-service'
import { ImageIcon } from 'lucide-react'

// 文件类型 - 使用URL而不是base64内容
export interface ChatFile {
  id: string
  name: string
  type: string
  size: number
  url: string // 改为使用URL
  uploadProgress?: number // 新增：上传进度
}

interface MultiModalUploadProps {
  multiModal?: boolean // 是否启用多模态功能
  uploadedFiles: ChatFile[] // 已上传的文件列表
  setUploadedFiles: React.Dispatch<React.SetStateAction<ChatFile[]>> // 设置文件列表的函数
  disabled?: boolean // 是否禁用
  className?: string // 额外的样式类
  showFileList?: boolean // 是否显示文件列表，默认为true
}

export default function MultiModalUpload({
  multiModal = false,
  uploadedFiles,
  setUploadedFiles,
  disabled = false,
  className = "",
  showFileList = true
}: MultiModalUploadProps) {
  const [isUploadingFiles, setIsUploadingFiles] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (!multiModal) {
      toast({
        title: "多模态功能未启用",
        description: "请在Agent配置中启用多模态功能",
        variant: "destructive"
      })
      return
    }

    setIsUploadingFiles(true)

    // 准备上传文件信息
    const uploadFiles: UploadFileInfo[] = Array.from(files).map(file => ({
      file,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size
    }))

    // 创建临时文件状态（显示上传进度）
    const tempFiles: ChatFile[] = uploadFiles.map((fileInfo, index) => ({
      id: Date.now().toString() + index,
      name: fileInfo.fileName,
      type: fileInfo.fileType,
      size: fileInfo.fileSize,
      url: '', // 暂时为空
      uploadProgress: 0
    }))

    try {
      // 先添加临时文件到状态中
      setUploadedFiles(prev => [...prev, ...tempFiles])

      // 批量上传文件
      const uploadResults = await uploadMultipleFiles(
        uploadFiles,
        // 进度回调
        (fileIndex, progress) => {
          const tempFileId = tempFiles[fileIndex].id
          setUploadedFiles(prev => 
            prev.map(file => 
              file.id === tempFileId 
                ? { ...file, uploadProgress: progress }
                : file
            )
          )
        },
        // 单个文件完成回调
        (fileIndex, result) => {
          const tempFileId = tempFiles[fileIndex].id
          setUploadedFiles(prev => 
            prev.map(file => 
              file.id === tempFileId 
                ? { 
                    ...file, 
                    url: result.url, 
                    uploadProgress: 100,
                    name: result.fileName,
                    type: result.fileType,
                    size: result.fileSize
                  }
                : file
            )
          )
 
        },
        // 错误回调
        (fileIndex, error) => {
          const tempFileId = tempFiles[fileIndex].id
 
          
          // 移除失败的文件
          setUploadedFiles(prev => prev.filter(file => file.id !== tempFileId))
          
          toast({
            title: "文件上传失败",
            description: `${uploadFiles[fileIndex].fileName}: ${error.message}`,
            variant: "destructive"
          })
        }
      )

      if (uploadResults.length > 0) {
        toast({
          title: "文件上传成功",
          description: `已上传 ${uploadResults.length} 个文件`
        })
      }
    } catch (error) {
 
      
      // 清理所有临时文件
      setUploadedFiles(prev => 
        prev.filter(file => !tempFiles.some((temp: ChatFile) => temp.id === file.id))
      )
      
      toast({
        title: "文件上传失败",
        description: error instanceof Error ? error.message : "请重试",
        variant: "destructive"
      })
    } finally {
      setIsUploadingFiles(false)
      // 清空文件选择
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 移除文件
  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
  }

  // 触发文件选择
  const triggerFileSelect = () => {
    if (!multiModal) {
      toast({
        title: "多模态功能未启用",
        description: "请在Agent配置中启用多模态功能",
        variant: "destructive"
      })
      return
    }
    fileInputRef.current?.click()
  }

  return (
    <div className={`${className}`}>
      {/* 上传按钮 - 更紧凑的设计 */}
      {multiModal && (
        <div className="flex flex-col items-start gap-1">
          {/* 已上传文件列表 - 紧凑显示 */}
          {showFileList && uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1 max-w-xs">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-1 px-2 py-1 bg-accent/60 rounded text-xs border border-border"
                >
                  <div className="flex-shrink-0 w-4 h-4 bg-accent rounded flex items-center justify-center">
                    {file.type.startsWith('image/') ? (
                      <span className="text-xs">🖼️</span>
                    ) : (
                      <span className="text-xs">📄</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate max-w-20">
                      {file.name}
                    </p>
                    {/* 上传进度条 */}
                    {file.uploadProgress !== undefined && file.uploadProgress < 100 && (
                      <div className="w-full bg-muted rounded-full h-0.5 mt-0.5">
                        <div
                          className="bg-primary h-0.5 rounded-full transition-all duration-300"
                          style={{ width: `${file.uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="flex-shrink-0 hover:bg-accent rounded p-0.5"
                    disabled={disabled}
                  >
                    <X className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* 上传按钮 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.txt"
            onChange={handleFileUpload}
            className="hidden"
            disabled={disabled}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploadingFiles}
            className="h-10 w-10 rounded-xl p-0 hover:bg-muted"
          >
            {isUploadingFiles ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Paperclip className="h-5 w-5 text-muted-foreground" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
} 