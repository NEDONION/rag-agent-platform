package org.lucas.application.rag.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.util.List;
import org.dromara.x.file.storage.core.FileStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.lucas.application.rag.assembler.DocumentUnitAssembler;
import org.lucas.application.rag.assembler.FileDetailInfoAssembler;
import org.lucas.application.rag.dto.*;
import org.lucas.domain.rag.message.RagDocSyncStorageMessage;
import org.lucas.domain.rag.model.DocumentUnitEntity;
import org.lucas.domain.rag.model.FileDetailEntity;
import org.lucas.domain.rag.service.DocumentUnitDomainService;
import org.lucas.domain.rag.service.FileDetailDomainService;
import org.lucas.infrastructure.mq.enums.EventType;
import org.lucas.infrastructure.mq.events.RagDocSyncStorageEvent;

/** 文件操作应用服务
 * 
 * @author shilong.zang */
@Service
public class FileOperationAppService {

    private static final Logger logger = LoggerFactory.getLogger(FileOperationAppService.class);

    private final FileDetailDomainService fileDetailDomainService;
    private final DocumentUnitDomainService documentUnitDomainService;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final FileStorageService fileStorageService;

    public FileOperationAppService(FileDetailDomainService fileDetailDomainService,
            DocumentUnitDomainService documentUnitDomainService, ApplicationEventPublisher applicationEventPublisher,
            FileStorageService fileStorageService) {
        this.fileDetailDomainService = fileDetailDomainService;
        this.documentUnitDomainService = documentUnitDomainService;
        this.applicationEventPublisher = applicationEventPublisher;
        this.fileStorageService = fileStorageService;
    }

    /** 根据文件ID获取文件详细信息
     * 
     * @param fileId 文件ID
     * @param userId 用户ID
     * @return 文件详细信息 */
    public FileDetailInfoDTO getFileDetailInfo(String fileId, String userId) {
        FileDetailEntity entity = fileDetailDomainService.getFileById(fileId, userId);
        return FileDetailInfoAssembler.toDTO(entity);
    }

    /** 分页查询文件的语料
     * 
     * @param request 查询请求
     * @param userId 用户ID
     * @return 分页结果 */
    public Page<DocumentUnitDTO> listDocumentUnits(QueryDocumentUnitsRequest request, String userId) {
        // 验证文件是否存在和权限
        fileDetailDomainService.getFileById(request.getFileId(), userId);

        IPage<DocumentUnitEntity> entityPage = documentUnitDomainService.listDocumentUnits(request.getFileId(), userId,
                request.getPage(), request.getPageSize(), request.getKeyword());

        Page<DocumentUnitDTO> dtoPage = new Page<>(entityPage.getCurrent(), entityPage.getSize(),
                entityPage.getTotal());

        List<DocumentUnitDTO> dtoList = DocumentUnitAssembler.toDTOs(entityPage.getRecords());
        dtoPage.setRecords(dtoList);
        return dtoPage;
    }

    /** 更新语料内容
     * 
     * @param request 更新请求
     * @param userId 用户ID
     * @return 更新后的语料 */
    @Transactional
    public DocumentUnitDTO updateDocumentUnit(UpdateDocumentUnitRequest request, String userId) {
        // 验证语料是否存在
        DocumentUnitEntity existingEntity = documentUnitDomainService.getDocumentUnit(request.getDocumentUnitId(),
                userId);

        // 转换并更新
        DocumentUnitEntity updateEntity = DocumentUnitAssembler.toEntity(request, userId);
        documentUnitDomainService.updateDocumentUnit(updateEntity, userId);

        // 如果需要重新向量化，发送MQ消息
        if (Boolean.TRUE.equals(request.getReEmbedding())) {
            triggerReEmbedding(existingEntity, request.getContent());
        }

        // 返回更新后的实体
        DocumentUnitEntity updatedEntity = documentUnitDomainService.getDocumentUnit(request.getDocumentUnitId(),
                userId);
        return DocumentUnitAssembler.toDTO(updatedEntity);
    }

    /** 删除语料
     * 
     * @param documentUnitId 语料ID
     * @param userId 用户ID */
    @Transactional
    public void deleteDocumentUnit(String documentUnitId, String userId) {
        // 验证语料是否存在
        documentUnitDomainService.checkDocumentUnitExists(documentUnitId, userId);

        // 删除语料
        documentUnitDomainService.deleteDocumentUnit(documentUnitId, userId);
    }

    /** 批量删除文件
     * 
     * @param request 批量删除请求
     * @param userId 用户ID */
    @Transactional
    public void batchDeleteFiles(BatchDeleteFilesRequest request, String userId) {
        for (String fileUrl : request.getFileUrls()) {
            try {
                fileStorageService.delete(fileUrl);
            } catch (Exception e) {
                // 记录日志但继续删除其他文件
                logger.error("删除文件失败，跳过并继续处理其余文件: {}", fileUrl, e);
            }
        }
    }

    /** 触发重新向量化
     * 
     * @param documentUnit 文档单元
     * @param newContent 新内容 */
    private void triggerReEmbedding(DocumentUnitEntity documentUnit, String newContent) {
        try {
            // 获取文件信息
            FileDetailEntity fileEntity = fileDetailDomainService.getFileByIdWithoutUserCheck(documentUnit.getFileId());

            // 构建向量化消息
            RagDocSyncStorageMessage storageMessage = new RagDocSyncStorageMessage();
            storageMessage.setId(documentUnit.getId());
            storageMessage.setFileId(documentUnit.getFileId());
            storageMessage.setFileName(fileEntity.getOriginalFilename());
            storageMessage.setPage(documentUnit.getPage());
            storageMessage.setContent(newContent);
            storageMessage.setVector(true);
            storageMessage.setDatasetId(fileEntity.getDataSetId());

            // 发送MQ事件
            RagDocSyncStorageEvent<RagDocSyncStorageMessage> storageEvent = new RagDocSyncStorageEvent<>(storageMessage,
                    EventType.DOC_SYNC_RAG);
            storageEvent.setDescription("语料内容修改后重新向量化 - 页面 " + documentUnit.getPage());
            applicationEventPublisher.publishEvent(storageEvent);

        } catch (Exception e) {
            // 记录日志但不影响主流程：内容已保存，向量化失败不应回滚用户的修改
            logger.error("触发重新向量化失败，文档单元 {} 的向量可能与内容不一致", documentUnit.getId(), e);
        }
    }
}