package org.lucas.application.rag.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.service.AiServices;
import dev.langchain4j.service.TokenStream;
import dev.langchain4j.store.memory.chat.InMemoryChatMemoryStore;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import org.dromara.streamquery.stream.core.stream.Steam;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.lucas.application.conversation.dto.AgentChatResponse;
import org.lucas.application.conversation.service.message.Agent;
import org.lucas.application.rag.RagMarketAppService;
import org.lucas.application.rag.RagPublishAppService;
import org.lucas.application.rag.assembler.DocumentUnitAssembler;
import org.lucas.application.rag.assembler.FileDetailAssembler;
import org.lucas.application.rag.assembler.FileProcessProgressAssembler;
import org.lucas.application.rag.assembler.RagQaDatasetAssembler;
import org.lucas.application.rag.dto.*;
import org.lucas.application.rag.request.PublishRagRequest;
import org.lucas.domain.conversation.constant.MessageType;
import org.lucas.domain.llm.model.HighAvailabilityResult;
import org.lucas.domain.llm.model.ModelEntity;
import org.lucas.domain.llm.model.ProviderEntity;
import org.lucas.domain.llm.service.HighAvailabilityDomainService;
import org.lucas.domain.llm.service.LLMDomainService;
import org.lucas.domain.rag.constant.FileProcessingStatusEnum;
import org.lucas.domain.rag.message.RagDocSyncOcrMessage;
import org.lucas.domain.rag.message.RagDocSyncStorageMessage;
import org.lucas.domain.rag.model.DocumentUnitEntity;
import org.lucas.domain.rag.model.FileDetailEntity;
import org.lucas.domain.rag.model.ModelConfig;
import org.lucas.domain.rag.model.RagQaDatasetEntity;
import org.lucas.domain.rag.model.RagVersionEntity;
import org.lucas.domain.rag.model.UserRagEntity;
import org.lucas.domain.rag.model.UserRagFileEntity;
import org.lucas.domain.rag.repository.DocumentUnitRepository;
import org.lucas.domain.rag.repository.FileDetailRepository;
import org.lucas.domain.rag.repository.UserRagFileRepository;
import org.lucas.domain.rag.service.*;
import org.lucas.domain.user.service.UserSettingsDomainService;
import org.lucas.infrastructure.exception.BusinessException;
import org.lucas.infrastructure.llm.LLMServiceFactory;
import org.lucas.infrastructure.mq.enums.EventType;
import org.lucas.infrastructure.mq.events.RagDocSyncOcrEvent;
import org.lucas.infrastructure.mq.events.RagDocSyncStorageEvent;
import org.lucas.infrastructure.rag.factory.EmbeddingModelFactory;

/** RAG数据集应用服务
 * @author shilong.zang
 * @date 2024-12-09 */
@Service
public class RagQaDatasetAppService {

    private static final Logger log = LoggerFactory.getLogger(RagQaDatasetAppService.class);
    private static final double RAG_RELEVANCE_THRESHOLD = 0.7;
    private static final double RAG_RELEVANCE_MIN_SCORE = 0.1;
    private static final int RAG_RELEVANCE_MAX_RESULTS = 5;
    private static final int REWRITE_CONTEXT_MAX_DOCS = 2;
    private static final int REWRITE_CONTEXT_MAX_CHARS = 240;

    private final RagQaDatasetDomainService ragQaDatasetDomainService;
    private final FileDetailDomainService fileDetailDomainService;
    private final DocumentUnitRepository documentUnitRepository;
    private final FileDetailRepository fileDetailRepository;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final EmbeddingDomainService embeddingDomainService;
    private final ObjectMapper objectMapper;
    private final LLMServiceFactory llmServiceFactory;
    private final LLMDomainService llmDomainService;
    private final UserSettingsDomainService userSettingsDomainService;
    private final HighAvailabilityDomainService highAvailabilityDomainService;

    // 添加RAG发布和市场服务依赖
    private final RagPublishAppService ragPublishAppService;
    private final RagMarketAppService ragMarketAppService;
    private final RagVersionDomainService ragVersionDomainService;
    private final UserRagDomainService userRagDomainService;
    private final RagDataAccessDomainService ragDataAccessService;
    private final RagModelConfigService ragModelConfigService;
    private final EmbeddingModelFactory embeddingModelFactory;
    private final UserRagFileRepository userRagFileRepository;

    public RagQaDatasetAppService(RagQaDatasetDomainService ragQaDatasetDomainService,
            FileDetailDomainService fileDetailDomainService, DocumentUnitRepository documentUnitRepository,
            FileDetailRepository fileDetailRepository, ApplicationEventPublisher applicationEventPublisher,
            EmbeddingDomainService embeddingDomainService, ObjectMapper objectMapper,
            LLMServiceFactory llmServiceFactory, LLMDomainService llmDomainService,
            UserSettingsDomainService userSettingsDomainService,
            HighAvailabilityDomainService highAvailabilityDomainService, RagPublishAppService ragPublishAppService,
            RagMarketAppService ragMarketAppService, RagVersionDomainService ragVersionDomainService,
            UserRagDomainService userRagDomainService, RagDataAccessDomainService ragDataAccessService,
            RagModelConfigService ragModelConfigService, EmbeddingModelFactory embeddingModelFactory,
            UserRagFileRepository userRagFileRepository) {
        this.ragQaDatasetDomainService = ragQaDatasetDomainService;
        this.fileDetailDomainService = fileDetailDomainService;
        this.documentUnitRepository = documentUnitRepository;
        this.fileDetailRepository = fileDetailRepository;
        this.applicationEventPublisher = applicationEventPublisher;
        this.embeddingDomainService = embeddingDomainService;
        this.objectMapper = objectMapper;
        this.llmServiceFactory = llmServiceFactory;
        this.llmDomainService = llmDomainService;
        this.userSettingsDomainService = userSettingsDomainService;
        this.highAvailabilityDomainService = highAvailabilityDomainService;
        this.ragPublishAppService = ragPublishAppService;
        this.ragMarketAppService = ragMarketAppService;
        this.ragVersionDomainService = ragVersionDomainService;
        this.userRagDomainService = userRagDomainService;
        this.ragDataAccessService = ragDataAccessService;
        this.ragModelConfigService = ragModelConfigService;
        this.embeddingModelFactory = embeddingModelFactory;
        this.userRagFileRepository = userRagFileRepository;
    }

    /** 创建数据集
     * @param request 创建请求
     * @param userId 用户ID
     * @return 数据集DTO */
    @Transactional
    public RagQaDatasetDTO createDataset(CreateDatasetRequest request, String userId) {
        RagQaDatasetEntity entity = RagQaDatasetAssembler.toEntity(request, userId);
        RagQaDatasetEntity createdEntity = ragQaDatasetDomainService.createDataset(entity);

        // 自动创建0.0.1版本并安装给用户
        try {
            createAndInstallInitialVersion(createdEntity.getId(), userId);
        } catch (Exception e) {
            log.warn("Failed to create initial version for dataset {}: {}", createdEntity.getId(), e.getMessage());
            // 不影响数据集创建，只记录警告
        }

        return RagQaDatasetAssembler.toDTO(createdEntity, 0L);
    }

    /** 创建并安装初始版本
     * @param ragId 数据集ID
     * @param userId 用户ID */
    private void createAndInstallInitialVersion(String ragId, String userId) {
        // 创建0.0.1版本的发布请求
        PublishRagRequest publishRequest = new PublishRagRequest();
        publishRequest.setRagId(ragId);
        publishRequest.setVersion("0.0.1");
        publishRequest.setChangeLog("创建 RAG 默认版本");

        // 发布版本（保持为REVIEWING状态，不公开）
        RagVersionDTO versionDTO = ragPublishAppService.publishRagVersion(publishRequest, userId);

        // 使用新的自动安装方法（直接创建REFERENCE类型安装）
        userRagDomainService.autoInstallRag(userId, ragId, versionDTO.getId());

        log.info("Successfully created and auto-installed initial version 0.0.1 for dataset {} by user {}", ragId,
                userId);
    }

    /** 同步版本信息
     * @param datasetId 数据集ID
     * @param name 新名称
     * @param description 新描述
     * @param icon 新图标
     * @param userId 用户ID */
    private void syncVersionInfo(String datasetId, String name, String description, String icon, String userId) {
        // 查找对应的0.0.1版本
        RagVersionEntity version001 = ragVersionDomainService.findVersionByOriginalRagIdAndVersion(datasetId, "0.0.1",
                userId);

        if (version001 != null) {
            // 更新0.0.1版本的基本信息
            ragVersionDomainService.updateVersionBasicInfo(version001.getId(), name, description, icon, userId);
            log.debug("Successfully synced version 0.0.1 info for dataset {}", datasetId);
        } else {
            log.debug("Version 0.0.1 not found for dataset {}, skip sync", datasetId);
        }

        // 同步更新用户安装记录的基本信息（针对REFERENCE类型）
        try {
            userRagDomainService.updateUserRagBasicInfo(userId, datasetId, name, description, icon);
            log.debug("Successfully synced user installation info for dataset {}", datasetId);
        } catch (Exception e) {
            log.warn("Failed to sync user installation info for dataset {}: {}", datasetId, e.getMessage());
            // 不抛出异常，避免影响主流程
        }
    }

    /** 更新数据集
     * @param datasetId 数据集ID
     * @param request 更新请求
     * @param userId 用户ID
     * @return 数据集DTO */
    @Transactional
    public RagQaDatasetDTO updateDataset(String datasetId, UpdateDatasetRequest request, String userId) {
        RagQaDatasetEntity entity = RagQaDatasetAssembler.toEntity(request, datasetId, userId);
        ragQaDatasetDomainService.updateDataset(entity);

        // 同步更新对应的0.0.1版本信息（如果存在）
        try {
            syncVersionInfo(datasetId, request.getName(), request.getDescription(), request.getIcon(), userId);
        } catch (Exception e) {
            log.warn("Failed to sync version info for dataset {}: {}", datasetId, e.getMessage());
            // 不影响主流程，只记录警告
        }

        // 获取更新后的实体
        RagQaDatasetEntity updatedEntity = ragQaDatasetDomainService.getDataset(datasetId, userId);
        Long fileCount = fileDetailDomainService.countFilesByDataset(datasetId, userId);
        return RagQaDatasetAssembler.toDTO(updatedEntity, fileCount);
    }

    /** 删除数据集
     * @param datasetId 数据集ID
     * @param userId 用户ID */
    @Transactional
    public void deleteDataset(String datasetId, String userId) {
        // 参考工具删除逻辑：先获取版本历史，然后删除创建者自己的安装记录
        List<RagVersionDTO> versions = Collections.emptyList();
        try {
            versions = ragPublishAppService.getRagVersionHistory(datasetId, userId);
        } catch (Exception e) {
            log.debug("Failed to get version history for dataset {}, may not have versions", datasetId);
        }

        // 删除创建者自己在user_rags表中的安装记录（在删除数据集之前执行）
        try {
            // 按原始RAG ID删除安装记录，避免业务逻辑校验导致的事务回滚
            userRagDomainService.forceUninstallRagByOriginalId(userId, datasetId);
        } catch (Exception e) {
            // 如果没有安装记录，忽略异常
            log.debug("No installation record found for dataset {}", datasetId);
        }

        // 删除所有RAG发布版本
        for (RagVersionDTO version : versions) {
            try {
                ragVersionDomainService.deleteRagVersion(version.getId(), userId);
            } catch (Exception e) {
                // 如果版本不存在，忽略异常
                log.debug("Failed to delete RAG version {}, may not exist", version.getId());
            }
        }

        // 先删除数据集下的所有文件
        fileDetailDomainService.deleteAllFilesByDataset(datasetId, userId);

        // 再删除数据集
        ragQaDatasetDomainService.deleteDataset(datasetId, userId);
    }

    /** 获取数据集详情
     * @param datasetId 数据集ID
     * @param userId 用户ID
     * @return 数据集DTO */
    public RagQaDatasetDTO getDataset(String datasetId, String userId) {
        RagQaDatasetEntity entity = ragQaDatasetDomainService.getDataset(datasetId, userId);
        Long fileCount = fileDetailDomainService.countFilesByDataset(datasetId, userId);
        return RagQaDatasetAssembler.toDTO(entity, fileCount);
    }

    /** 获取数据集详情（用于Agent配置）
     * @param datasetId 数据集ID
     * @param userId 用户ID
     * @return 数据集DTO */
    public RagQaDatasetDTO getDatasetById(String datasetId, String userId) {
        return getDataset(datasetId, userId);
    }

    /** 获取用户可用的知识库详情（仅限已安装的知识库）
     * 
     * @param knowledgeBaseId 知识库ID（可能是originalRagId或userRagId）
     * @param userId 用户ID
     * @return 知识库详情
     * @throws BusinessException 如果知识库未安装或无权限访问 */
    public RagQaDatasetDTO getAvailableDatasetById(String knowledgeBaseId, String userId) {
        // 首先尝试作为userRagId查找已安装的知识库
        try {
            UserRagEntity userRag = userRagDomainService.getUserRag(userId, knowledgeBaseId);
            Long fileCount = getRagFileCount(userId, userRag);
            return RagQaDatasetAssembler.fromUserRagEntity(userRag, fileCount);
        } catch (Exception e) {
            // 如果不是userRagId，则尝试作为originalRagId查找已安装的知识库
            List<UserRagEntity> installedRags = userRagDomainService.listAllInstalledRags(userId);
            for (UserRagEntity userRag : installedRags) {
                if (knowledgeBaseId.equals(userRag.getOriginalRagId())) {
                    // 找到匹配的已安装知识库，返回快照信息
                    Long fileCount = getRagFileCount(userId, userRag);
                    return RagQaDatasetAssembler.fromUserRagEntity(userRag, fileCount);
                }
            }

            // 如果都没有找到，说明用户未安装该知识库，抛出异常
            throw new BusinessException("知识库未安装或无权限访问，请先安装该知识库");
        }
    }

    /** 批量获取数据集详情（用于Agent配置）
     * @param datasetIds 数据集ID列表
     * @param userId 用户ID
     * @return 数据集DTO列表 */
    public List<RagQaDatasetDTO> getDatasetsByIds(List<String> datasetIds, String userId) {
        List<RagQaDatasetDTO> datasets = new ArrayList<>();
        for (String datasetId : datasetIds) {
            try {
                RagQaDatasetDTO dataset = getDataset(datasetId, userId);
                datasets.add(dataset);
            } catch (Exception e) {
                log.warn("获取数据集 {} 失败，用户 {} 可能无权限访问: {}", datasetId, userId, e.getMessage());
                // 跳过无权限访问的数据集
            }
        }
        return datasets;
    }

    /** 获取用户可用的数据集列表（用于Agent配置） 只返回已安装的知识库（包括用户创建的和从市场安装的）
     * @param userId 用户ID
     * @return 数据集DTO列表 */
    public List<RagQaDatasetDTO> getUserAvailableDatasets(String userId) {
        List<RagQaDatasetDTO> availableDatasets = new ArrayList<>();

        // 获取用户所有已安装的RAG
        List<UserRagEntity> installedRags = userRagDomainService.listAllInstalledRags(userId);

        for (UserRagEntity userRag : installedRags) {
            try {
                // 根据RAG安装类型正确获取文件数量
                Long fileCount = getRagFileCount(userId, userRag);

                // 转换为DTO
                RagQaDatasetDTO dataset = RagQaDatasetAssembler.fromUserRagEntity(userRag, fileCount);
                availableDatasets.add(dataset);

            } catch (Exception e) {
                // 如果数据集不存在或无权限访问，跳过该安装记录
                log.warn("获取已安装RAG {} 失败，用户 {} 可能无权限访问或数据集已被删除: {}", userRag.getOriginalRagId(), userId,
                        e.getMessage());
            }
        }

        return availableDatasets;
    }

    /** 根据RAG安装类型获取正确的文件数量
     * 
     * @param userId 用户ID
     * @param userRag 用户RAG安装记录
     * @return 文件数量 */
    private Long getRagFileCount(String userId, UserRagEntity userRag) {
        if (userRag.isSnapshotType()) {
            // SNAPSHOT类型：统计用户快照文件数量
            return ragDataAccessService.countUserRagFiles(userRag.getId());
        } else {
            // REFERENCE类型：统计原始数据集文件数量（不进行用户权限检查，因为已安装表示有权限）
            return fileDetailDomainService.countFilesByDatasetWithoutUserCheck(userRag.getOriginalRagId());
        }
    }

    /** 分页查询数据集
     * @param request 查询请求
     * @param userId 用户ID
     * @return 分页结果 */
    public Page<RagQaDatasetDTO> listDatasets(QueryDatasetRequest request, String userId) {
        IPage<RagQaDatasetEntity> entityPage = ragQaDatasetDomainService.listDatasets(userId, request.getPage(),
                request.getPageSize(), request.getKeyword());

        Page<RagQaDatasetDTO> dtoPage = new Page<>(entityPage.getCurrent(), entityPage.getSize(),
                entityPage.getTotal());

        // 转换为DTO并添加文件数量
        List<RagQaDatasetDTO> dtoList = entityPage.getRecords().stream().map(entity -> {
            Long fileCount = fileDetailDomainService.countFilesByDataset(entity.getId(), userId);
            return RagQaDatasetAssembler.toDTO(entity, fileCount);
        }).toList();

        dtoPage.setRecords(dtoList);
        return dtoPage;
    }

    /** 获取所有数据集
     * @param userId 用户ID
     * @return 数据集列表 */
    public List<RagQaDatasetDTO> listAllDatasets(String userId) {
        List<RagQaDatasetEntity> entities = ragQaDatasetDomainService.listAllDatasets(userId);
        return entities.stream().map(entity -> {
            Long fileCount = fileDetailDomainService.countFilesByDataset(entity.getId(), userId);
            return RagQaDatasetAssembler.toDTO(entity, fileCount);
        }).toList();
    }

    /** 上传文件到数据集
     * @param request 上传请求
     * @param userId 用户ID
     * @return 文件DTO */
    @Transactional
    public FileDetailDTO uploadFile(UploadFileRequest request, String userId) {
        // 检查数据集是否存在
        ragQaDatasetDomainService.checkDatasetExists(request.getDatasetId(), userId);

        // 上传文件
        FileDetailEntity entity = FileDetailAssembler.toEntity(request, userId);
        FileDetailEntity uploadedEntity = fileDetailDomainService.uploadFileToDataset(entity);

        // 自动启动预处理流程
        autoStartPreprocessing(uploadedEntity.getId(), request.getDatasetId(), userId);

        return FileDetailAssembler.toDTO(uploadedEntity);
    }

    /** 自动启动预处理流程
     * @param fileId 文件ID
     * @param datasetId 数据集ID
     * @param userId 用户ID */
    private void autoStartPreprocessing(String fileId, String datasetId, String userId) {
        try {
            log.info("Auto-starting preprocessing for file: {}", fileId);

            // 清理已有的语料和向量数据
            cleanupExistingDocumentUnits(fileId);

            // 设置初始状态为初始化中
            // fileDetailDomainService.startFileOcrProcessing(fileId, userId);
            fileDetailDomainService.updateFileOcrProgress(fileId, 0, 0.0);
            // 重置向量化状态
            fileDetailDomainService.resetFileProcessing(fileId, userId);

            // 获取文件实体
            FileDetailEntity fileEntity = fileDetailDomainService.getFileByIdWithoutUserCheck(fileId);

            // 发送OCR处理MQ消息
            RagDocSyncOcrMessage ocrMessage = new RagDocSyncOcrMessage();
            ocrMessage.setFileId(fileId);
            ocrMessage.setPageSize(fileEntity.getFilePageSize());
            ocrMessage.setUserId(userId);
            // 获取用户的OCR模型配置并设置到消息中
            ocrMessage.setOcrModelConfig(ragModelConfigService.getUserOcrModelConfig(userId));

            RagDocSyncOcrEvent<RagDocSyncOcrMessage> ocrEvent = new RagDocSyncOcrEvent<>(ocrMessage,
                    EventType.DOC_REFRESH_ORG);
            ocrEvent.setDescription("文件自动预处理任务");
            applicationEventPublisher.publishEvent(ocrEvent);

            log.info("Auto-preprocessing started for file: {}", fileId);

        } catch (Exception e) {
            log.error("Failed to auto-start preprocessing for file: {}", fileId, e);
            // 如果自动启动失败，重置状态
            fileDetailDomainService.resetFileProcessing(fileId, userId);
        }
    }

    /** 删除数据集文件
     * @param datasetId 数据集ID
     * @param fileId 文件ID
     * @param userId 用户ID */
    @Transactional
    public void deleteFile(String datasetId, String fileId, String userId) {
        // 检查数据集是否存在
        ragQaDatasetDomainService.checkDatasetExists(datasetId, userId);

        // 删除文件
        fileDetailDomainService.deleteFile(fileId, userId);
    }

    /** 分页查询数据集文件
     * @param datasetId 数据集ID
     * @param request 查询请求
     * @param userId 用户ID
     * @return 分页结果 */
    public Page<FileDetailDTO> listDatasetFiles(String datasetId, QueryDatasetFileRequest request, String userId) {
        // 检查数据集是否存在
        ragQaDatasetDomainService.checkDatasetExists(datasetId, userId);

        IPage<FileDetailEntity> entityPage = fileDetailDomainService.listFilesByDataset(datasetId, userId,
                request.getPage(), request.getPageSize(), request.getKeyword());

        Page<FileDetailDTO> dtoPage = new Page<>(entityPage.getCurrent(), entityPage.getSize(), entityPage.getTotal());

        List<FileDetailDTO> dtoList = FileDetailAssembler.toDTOs(entityPage.getRecords());
        dtoPage.setRecords(dtoList);
        return dtoPage;
    }

    /** 获取数据集所有文件
     * @param datasetId 数据集ID
     * @param userId 用户ID
     * @return 文件列表 */
    public List<FileDetailDTO> listAllDatasetFiles(String datasetId, String userId) {
        // 检查数据集是否存在
        ragQaDatasetDomainService.checkDatasetExists(datasetId, userId);

        List<FileDetailEntity> entities = fileDetailDomainService.listAllFilesByDataset(datasetId, userId);
        return FileDetailAssembler.toDTOs(entities);
    }

    /** 启动文件预处理
     * @param request 预处理请求
     * @param userId 用户ID */
    @Transactional
    public void processFile(ProcessFileRequest request, String userId) {
        // 检查数据集是否存在
        ragQaDatasetDomainService.checkDatasetExists(request.getDatasetId(), userId);

        // 验证文件存在性和权限
        FileDetailEntity fileEntity = fileDetailDomainService.getFileById(request.getFileId(), userId);

        if (request.getProcessType() == 1) {
            // OCR预处理 - 检查是否可以启动预处理
            validateOcrProcessing(fileEntity);

            // 清理已有的语料和向量数据
            cleanupExistingDocumentUnits(request.getFileId());

            // fileDetailDomainService.startFileOcrProcessing(request.getFileId(), userId);
            fileDetailDomainService.updateFileOcrProgress(request.getFileId(), 0, 0.0);
            // 重置向量化状态
            fileDetailDomainService.resetFileProcessing(request.getFileId(), userId);

            // 发送OCR处理MQ消息
            RagDocSyncOcrMessage ocrMessage = new RagDocSyncOcrMessage();
            ocrMessage.setFileId(request.getFileId());
            ocrMessage.setPageSize(fileEntity.getFilePageSize());

            RagDocSyncOcrEvent<RagDocSyncOcrMessage> ocrEvent = new RagDocSyncOcrEvent<>(ocrMessage,
                    EventType.DOC_REFRESH_ORG);
            ocrEvent.setDescription("文件OCR预处理任务");
            applicationEventPublisher.publishEvent(ocrEvent);

        } else if (request.getProcessType() == 2) {
            // 向量化处理 - 检查是否可以启动向量化
            validateEmbeddingProcessing(fileEntity);

            fileDetailDomainService.startFileEmbeddingProcessing(request.getFileId(), userId);
            fileDetailDomainService.updateFileEmbeddingProgress(request.getFileId(), 0, 0.0);

            List<DocumentUnitEntity> documentUnits = documentUnitRepository.selectList(Wrappers
                    .lambdaQuery(DocumentUnitEntity.class).eq(DocumentUnitEntity::getFileId, request.getFileId())
                    .eq(DocumentUnitEntity::getIsOcr, true).eq(DocumentUnitEntity::getIsVector, false));

            if (documentUnits.isEmpty()) {
                throw new IllegalStateException("文件没有找到可用于向量化的语料数据");
            }

            // 为每个DocumentUnit发送单独的向量化MQ消息
            for (DocumentUnitEntity documentUnit : documentUnits) {
                RagDocSyncStorageMessage storageMessage = new RagDocSyncStorageMessage();
                storageMessage.setId(documentUnit.getId());
                storageMessage.setFileId(request.getFileId());
                storageMessage.setFileName(fileEntity.getOriginalFilename());
                storageMessage.setPage(documentUnit.getPage());
                storageMessage.setContent(documentUnit.getContent());
                storageMessage.setVector(true);
                storageMessage.setDatasetId(request.getDatasetId()); // 设置数据集ID

                RagDocSyncStorageEvent<RagDocSyncStorageMessage> storageEvent = new RagDocSyncStorageEvent<>(
                        storageMessage, EventType.DOC_SYNC_RAG);
                storageEvent.setDescription("文件向量化处理任务 - 页面 " + documentUnit.getPage());
                applicationEventPublisher.publishEvent(storageEvent);
            }

        } else {
            throw new IllegalArgumentException("不支持的处理类型: " + request.getProcessType());
        }
    }

    /** 验证OCR预处理是否可以启动
     * @param fileEntity 文件实体 */
    private void validateOcrProcessing(FileDetailEntity fileEntity) {
        Integer processingStatus = fileEntity.getProcessingStatus();

        // 如果正在初始化，不能重复启动
        if (processingStatus != null && (processingStatus.equals(FileProcessingStatusEnum.OCR_PROCESSING.getCode())
                || processingStatus.equals(FileProcessingStatusEnum.EMBEDDING_PROCESSING.getCode()))) {
            throw new IllegalStateException("文件正在处理中，请等待处理完成");
        }
    }

    /** 验证向量化处理是否可以启动
     * @param fileEntity 文件实体 */
    private void validateEmbeddingProcessing(FileDetailEntity fileEntity) {
        Integer processingStatus = fileEntity.getProcessingStatus();

        // 必须先完成OCR处理
        if (processingStatus == null || (!processingStatus.equals(FileProcessingStatusEnum.OCR_COMPLETED.getCode())
                && !processingStatus.equals(FileProcessingStatusEnum.EMBEDDING_PROCESSING.getCode())
                && !processingStatus.equals(FileProcessingStatusEnum.COMPLETED.getCode())
                && !processingStatus.equals(FileProcessingStatusEnum.EMBEDDING_FAILED.getCode()))) {
            throw new IllegalStateException("文件需要先完成预处理才能进行向量化");
        }

        // 如果正在向量化，不能重复启动
        if (processingStatus.equals(FileProcessingStatusEnum.EMBEDDING_PROCESSING.getCode())) {
            throw new IllegalStateException("文件正在向量化中，请等待处理完成");
        }
    }

    /** 重新启动文件处理（强制重启，仅用于调试）
     * @param request 预处理请求
     * @param userId 用户ID */
    @Transactional
    public void reprocessFile(ProcessFileRequest request, String userId) {
        log.warn("Force reprocessing file: {}, type: {}, user: {}", request.getFileId(), request.getProcessType(),
                userId);

        // 检查数据集是否存在
        ragQaDatasetDomainService.checkDatasetExists(request.getDatasetId(), userId);

        // 验证文件存在性和权限
        FileDetailEntity fileEntity = fileDetailDomainService.getFileById(request.getFileId(), userId);

        if (request.getProcessType() == 1) {
            // 强制重新OCR预处理
            log.info("Force restarting OCR preprocessing for file: {}", request.getFileId());

            // 清理已有的语料和向量数据
            cleanupExistingDocumentUnits(request.getFileId());

            // 重置状态
            // fileDetailDomainService.startFileOcrProcessing(request.getFileId(), userId);
            fileDetailDomainService.updateFileOcrProgress(request.getFileId(), 0, 0.0);
            // 也重置向量化状态
            fileDetailDomainService.resetFileProcessing(request.getFileId(), userId);

            // 发送OCR处理MQ消息
            RagDocSyncOcrMessage ocrMessage = new RagDocSyncOcrMessage();
            ocrMessage.setFileId(request.getFileId());
            ocrMessage.setPageSize(fileEntity.getFilePageSize());

            RagDocSyncOcrEvent<RagDocSyncOcrMessage> ocrEvent = new RagDocSyncOcrEvent<>(ocrMessage,
                    EventType.DOC_REFRESH_ORG);
            ocrEvent.setDescription("文件强制重新OCR预处理任务");
            applicationEventPublisher.publishEvent(ocrEvent);

        } else if (request.getProcessType() == 2) {
            // 强制重新向量化处理
            log.info("Force restarting vectorization for file: {}", request.getFileId());

            // 检查是否已完成OCR处理
            Integer processingStatus = fileEntity.getProcessingStatus();
            if (processingStatus == null || (!processingStatus.equals(FileProcessingStatusEnum.OCR_COMPLETED.getCode())
                    && !processingStatus.equals(FileProcessingStatusEnum.EMBEDDING_PROCESSING.getCode())
                    && !processingStatus.equals(FileProcessingStatusEnum.COMPLETED.getCode())
                    && !processingStatus.equals(FileProcessingStatusEnum.EMBEDDING_FAILED.getCode()))) {
                throw new IllegalStateException("文件需要先完成预处理才能进行向量化");
            }

            // 重置向量化状态
            fileDetailDomainService.startFileEmbeddingProcessing(request.getFileId(), userId);

            List<DocumentUnitEntity> documentUnits = documentUnitRepository.selectList(Wrappers
                    .lambdaQuery(DocumentUnitEntity.class).eq(DocumentUnitEntity::getFileId, request.getFileId())
                    .eq(DocumentUnitEntity::getIsOcr, true));

            if (documentUnits.isEmpty()) {
                throw new IllegalStateException("文件没有找到可用于向量化的语料数据");
            }

            // 重置所有文档单元的向量化状态
            for (DocumentUnitEntity documentUnit : documentUnits) {
                documentUnit.setIsVector(false);
                documentUnitRepository.updateById(documentUnit);
            }

            // 为每个DocumentUnit发送向量化MQ消息
            for (DocumentUnitEntity documentUnit : documentUnits) {
                RagDocSyncStorageMessage storageMessage = new RagDocSyncStorageMessage();
                storageMessage.setId(documentUnit.getId());
                storageMessage.setFileId(request.getFileId());
                storageMessage.setFileName(fileEntity.getOriginalFilename());
                storageMessage.setPage(documentUnit.getPage());
                storageMessage.setContent(documentUnit.getContent());
                storageMessage.setVector(true);
                storageMessage.setDatasetId(request.getDatasetId());

                RagDocSyncStorageEvent<RagDocSyncStorageMessage> storageEvent = new RagDocSyncStorageEvent<>(
                        storageMessage, EventType.DOC_SYNC_RAG);
                storageEvent.setDescription("文件强制重新向量化处理任务 - 页面 " + documentUnit.getPage());
                applicationEventPublisher.publishEvent(storageEvent);
            }

        } else {
            throw new IllegalArgumentException("不支持的处理类型: " + request.getProcessType());
        }
    }

    /** 清理文件的已有语料和向量数据
     * @param fileId 文件ID */
    private void cleanupExistingDocumentUnits(String fileId) {
        try {
            // 查询该文件的所有文档单元
            List<DocumentUnitEntity> existingUnits = documentUnitRepository
                    .selectList(Wrappers.<DocumentUnitEntity>lambdaQuery().eq(DocumentUnitEntity::getFileId, fileId));

            if (!existingUnits.isEmpty()) {
                log.info("Cleaning up {} existing document units for file: {}", existingUnits.size(), fileId);

                final List<String> documentUnitEntities = Steam.of(existingUnits).map(DocumentUnitEntity::getId)
                        .toList();
                // 删除所有文档单元（包括语料和向量数据）
                documentUnitRepository.deleteByIds(documentUnitEntities);

                embeddingDomainService.deleteEmbedding(Collections.singletonList(fileId));
                log.info("Successfully cleaned up document units for file: {}", fileId);
            } else {
                log.debug("No existing document units found for file: {}", fileId);
            }
        } catch (Exception e) {
            log.error("Failed to cleanup existing document units for file: {}", fileId, e);
            throw new BusinessException("清理已有语料数据失败: " + e.getMessage());
        }
    }

    /** 获取文件处理进度
     * @param fileId 文件ID
     * @param userId 用户ID
     * @return 处理进度 */
    public FileProcessProgressDTO getFileProgress(String fileId, String userId) {
        FileDetailEntity fileEntity = fileDetailDomainService.getFileById(fileId, userId);
        return FileProcessProgressAssembler.toDTO(fileEntity);
    }

    /** 获取数据集文件处理进度列表
     * @param datasetId 数据集ID
     * @param userId 用户ID
     * @return 处理进度列表 */
    public List<FileProcessProgressDTO> getDatasetFilesProgress(String datasetId, String userId) {
        // 检查数据集是否存在
        ragQaDatasetDomainService.checkDatasetExists(datasetId, userId);

        List<FileDetailEntity> entities = fileDetailDomainService.listAllFilesByDataset(datasetId, userId);
        return FileProcessProgressAssembler.toDTOs(entities);
    }

    /** RAG搜索文档（使用智能参数优化）
     * @param request 搜索请求
     * @param userId 用户ID
     * @return 搜索结果 */
    public List<DocumentUnitDTO> ragSearch(RagSearchRequest request, String userId) {
        // 验证数据集权限 - 检查用户是否安装了这些知识库
        List<String> validDatasetIds = new ArrayList<>();
        for (String datasetId : request.getDatasetIds()) {
            // 检查用户是否安装了这个知识库
            if (userRagDomainService.isRagInstalledByOriginalId(userId, datasetId)) {
                validDatasetIds.add(datasetId);
                log.debug("用户 {} 已安装知识库 {}，允许搜索", userId, datasetId);
            } else {
                // 检查用户是否是创建者（向后兼容）
                try {
                    ragQaDatasetDomainService.checkDatasetExists(datasetId, userId);
                    validDatasetIds.add(datasetId);
                    log.debug("用户 {} 是知识库 {} 的创建者，允许搜索", userId, datasetId);
                } catch (Exception e) {
                    log.warn("用户 {} 既没有安装知识库 {} 也不是创建者，跳过搜索", userId, datasetId);
                }
            }
        }

        if (validDatasetIds.isEmpty()) {
            log.warn("用户 {} 没有任何有效的知识库可搜索", userId);
            return new ArrayList<>();
        }

        // 使用智能调整后的参数进行RAG搜索
        Double adjustedMinScore = request.getAdjustedMinScore();
        Integer adjustedCandidateMultiplier = request.getAdjustedCandidateMultiplier();

        // 获取用户的嵌入模型配置
        ModelConfig embeddingModelConfig = ragModelConfigService.getUserEmbeddingModelConfig(userId);
        EmbeddingModelFactory.EmbeddingConfig embeddingConfig = toEmbeddingConfig(embeddingModelConfig);

        // 调用领域服务进行RAG搜索，使用智能优化的参数
        List<DocumentUnitEntity> entities = embeddingDomainService.ragDoc(validDatasetIds, request.getQuestion(),
                request.getMaxResults(), adjustedMinScore, // 使用智能调整的相似度阈值
                request.getEnableRerank(), adjustedCandidateMultiplier, // 使用智能调整的候选结果倍数
                embeddingConfig, // 传入嵌入模型配置
                request.getEnableQueryExpansion()); // 传递查询扩展参数

        // 转换为DTO并返回
        return DocumentUnitAssembler.toDTOs(entities);
    }

    /** 基于已安装知识库的RAG搜索
     * 
     * @param request RAG搜索请求（使用userRagId作为数据源）
     * @param userRagId 用户已安装的RAG ID
     * @param userId 用户ID
     * @return 搜索结果 */
    public List<DocumentUnitDTO> ragSearchByUserRag(RagSearchRequest request, String userRagId, String userId) {
        // 获取RAG数据源信息
        RagDataAccessDomainService.RagDataSourceInfo sourceInfo = ragDataAccessService.getRagDataSourceInfo(userId,
                userRagId);

        // 根据安装类型获取实际的数据集ID
        String actualDatasetId;
        if (sourceInfo.getIsRealTime()) {
            // REFERENCE类型：使用原始数据集ID
            actualDatasetId = sourceInfo.getOriginalRagId();
        } else {
            // SNAPSHOT类型：使用原始数据集ID（但实际搜索会通过版本控制过滤）
            actualDatasetId = sourceInfo.getOriginalRagId();
        }

        // 验证数据集权限 - 通过userRagId已经验证了权限，不需要再检查用户是否是创建者
        // 只需要确认原始数据集仍然存在
        var originalDataset = ragQaDatasetDomainService.findDatasetById(actualDatasetId);
        if (originalDataset == null) {
            throw new BusinessException("原始数据集不存在或已被删除");
        }

        // 使用智能调整后的参数进行RAG搜索
        Double adjustedMinScore = request.getAdjustedMinScore();
        Integer adjustedCandidateMultiplier = request.getAdjustedCandidateMultiplier();

        // 获取用户的嵌入模型配置
        ModelConfig embeddingModelConfig = ragModelConfigService.getUserEmbeddingModelConfig(userId);
        EmbeddingModelFactory.EmbeddingConfig embeddingConfig = toEmbeddingConfig(embeddingModelConfig);

        List<DocumentUnitEntity> entities;
        if (sourceInfo.getIsRealTime()) {
            // REFERENCE类型：搜索实时数据
            entities = embeddingDomainService.ragDoc(List.of(actualDatasetId), request.getQuestion(),
                    request.getMaxResults(), adjustedMinScore, request.getEnableRerank(), adjustedCandidateMultiplier,
                    embeddingConfig, request.getEnableQueryExpansion());
        } else {
            // SNAPSHOT类型：搜索版本快照数据
            List<DocumentUnitEntity> snapshotDocuments = ragDataAccessService.getRagDocuments(userId, userRagId);
            // 对快照数据进行向量搜索（这里可能需要特殊处理，暂时使用相同逻辑）
            entities = embeddingDomainService.ragDoc(List.of(actualDatasetId), request.getQuestion(),
                    request.getMaxResults(), adjustedMinScore, request.getEnableRerank(), adjustedCandidateMultiplier,
                    embeddingConfig, request.getEnableQueryExpansion());
        }

        // 转换为DTO并返回
        return DocumentUnitAssembler.toDTOs(entities);
    }

    /** RAG流式问答
     * @param request 流式问答请求
     * @param userId 用户ID
     * @return SSE流式响应 */
    public SseEmitter ragStreamChat(RagStreamChatRequest request, String userId) {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);

        // 设置连接关闭回调
        emitter.onCompletion(() -> log.info("RAG stream chat completed for user: {}", userId));
        emitter.onTimeout(() -> {
            log.warn("RAG stream chat timeout for user: {}", userId);
            sendSseData(emitter, createErrorResponse("连接超时"));
        });
        emitter.onError((ex) -> {
            log.error("RAG stream chat connection error for user: {}", userId, ex);
        });

        // 异步处理流式问答
        CompletableFuture.runAsync(() -> {
            try {
                processRagStreamChat(request, userId, emitter);
            } catch (Exception e) {
                log.error("RAG stream chat error", e);
                sendSseData(emitter, createErrorResponse("处理过程中发生错误: " + e.getMessage()));
            } finally {
                // 确保连接被正确关闭
                try {
                    emitter.complete();
                } catch (Exception e) {
                    log.warn("Error completing SSE emitter", e);
                }
            }
        });

        return emitter;
    }

    /** 处理RAG流式问答的核心逻辑 */
    private void processRagStreamChat(RagStreamChatRequest request, String userId, SseEmitter emitter) {
        try {
            // 第一阶段：检索文档
            log.info("Starting RAG stream chat for user: {}, question: '{}'", userId, request.getQuestion());

            // 发送检索开始信号
            sendSseData(emitter, AgentChatResponse.build("开始检索相关文档...", MessageType.RAG_RETRIEVAL_START));
            Thread.sleep(500);

            // 确定检索范围
            List<String> searchDatasetIds = new ArrayList<>();
            List<String> searchFileIds = new ArrayList<>();

            if (request.getFileId() != null && !request.getFileId().trim().isEmpty()) {
                FileDetailEntity fileEntity = fileDetailDomainService.getFileById(request.getFileId(), userId);
                searchFileIds.add(request.getFileId());
                searchDatasetIds.add(fileEntity.getDataSetId());
                sendSseData(emitter, AgentChatResponse.build("正在指定文件中检索...", MessageType.RAG_RETRIEVAL_PROGRESS));
            } else if (request.getDatasetIds() != null && !request.getDatasetIds().isEmpty()) {
                for (String datasetId : request.getDatasetIds()) {
                    ragQaDatasetDomainService.checkDatasetExists(datasetId, userId);
                }
                searchDatasetIds.addAll(request.getDatasetIds());
                sendSseData(emitter, AgentChatResponse.build("正在数据集中检索...", MessageType.RAG_RETRIEVAL_PROGRESS));
            } else {
                throw new IllegalArgumentException("必须指定文件ID或数据集ID");
            }

            // 意图识别与语义改写
            // 获取用户的嵌入模型配置
            ModelConfig embeddingModelConfig = ragModelConfigService.getUserEmbeddingModelConfig(userId);
            EmbeddingModelFactory.EmbeddingConfig embeddingConfig = toEmbeddingConfig(embeddingModelConfig);

            // 意图识别与语义改写（基于相关性判断）
            IntentResult intentResult = classifyIntent(request.getQuestion(), userId);
            RelevanceCheckResult relevance = checkRelevanceForDatasets(searchDatasetIds, request.getQuestion(),
                    embeddingConfig);
            String effectiveQuestion = request.getQuestion();
            QueryExpansionResult expansion = QueryExpansionResult.empty();
            if (relevance.isRelevant) {
                effectiveQuestion = rewriteQuestion(request.getQuestion(), relevance.documents, userId);
                expansion = expandQueries(request.getQuestion(), relevance.documents, userId);
            }
            sendIntentRewriteToClient(emitter, intentResult, request.getQuestion(), effectiveQuestion, relevance,
                    expansion);

            // 执行RAG检索
            List<DocumentUnitEntity> retrievedDocuments;
            if (request.getFileId() != null && !request.getFileId().trim().isEmpty()) {
                retrievedDocuments = retrieveFromFile(request.getFileId(), effectiveQuestion,
                        request.getMaxResults(), embeddingConfig);
            } else {
                List<String> queries = buildQueryList(request.getQuestion(), effectiveQuestion, expansion);
                retrievedDocuments = retrieveWithMultipleQueries(searchDatasetIds, queries, request.getMaxResults(),
                        request.getMinScore(), request.getEnableRerank(), embeddingConfig);
            }

            // 构建检索结果
            List<RetrievedDocument> retrievedDocs = new ArrayList<>();
            for (DocumentUnitEntity doc : retrievedDocuments) {
                FileDetailEntity fileDetail = fileDetailRepository.selectById(doc.getFileId());
                double similarityScore = doc.getSimilarityScore() != null ? doc.getSimilarityScore() : 0.0;
                retrievedDocs.add(new RetrievedDocument(doc.getFileId(),
                        fileDetail != null ? fileDetail.getOriginalFilename() : "未知文件", doc.getId(),
                        similarityScore, doc.getPage(), buildSnippet(doc.getContent())));
            }

            // 发送检索完成信号
            String retrievalMessage = String.format("检索完成，找到 %d 个相关文档", retrievedDocs.size());
            AgentChatResponse retrievalEndResponse = AgentChatResponse.build(retrievalMessage,
                    MessageType.RAG_RETRIEVAL_END);
            try {
                retrievalEndResponse.setPayload(objectMapper.writeValueAsString(retrievedDocs));
            } catch (Exception e) {
                log.error("Failed to serialize retrieved documents", e);
            }
            sendSseData(emitter, retrievalEndResponse);
            Thread.sleep(1000);

            // 第二阶段：生成回答
            sendSseData(emitter, AgentChatResponse.build("开始生成回答...", MessageType.RAG_ANSWER_START));
            Thread.sleep(500);

            // 构建LLM上下文
            String context = buildContextFromDocuments(retrievedDocuments);
            String prompt = buildRagPrompt(effectiveQuestion, context);

            // 调用流式LLM - 使用同步等待确保流式处理完成
            String fullAnswer = generateStreamAnswerAndWait(prompt, userId, emitter);
            sendEvidenceCoverage(emitter, fullAnswer, retrievedDocuments, embeddingConfig);

            // 在LLM流式处理完成后发送完成信号
            sendSseData(emitter, AgentChatResponse.buildEndMessage("回答生成完成", MessageType.RAG_ANSWER_END));

        } catch (Exception e) {
            log.error("Error in RAG stream chat processing", e);
            sendSseData(emitter, createErrorResponse("处理过程中发生错误: " + e.getMessage()));
        } finally {
            emitter.complete();
        }
    }

    /** 从指定文件中检索相关文档 */
    private List<DocumentUnitEntity> retrieveFromFile(String fileId, String question, Integer maxResults,
            EmbeddingModelFactory.EmbeddingConfig embeddingConfig) {
        // 查询文件下的所有文档单元
        List<DocumentUnitEntity> fileDocuments = documentUnitRepository
                .selectList(Wrappers.lambdaQuery(DocumentUnitEntity.class).eq(DocumentUnitEntity::getFileId, fileId)
                        .eq(DocumentUnitEntity::getIsVector, true));

        if (fileDocuments.isEmpty()) {
            return new ArrayList<>();
        }

        // 获取文档ID列表
        List<String> documentIds = fileDocuments.stream().map(DocumentUnitEntity::getId).collect(Collectors.toList());

        // 使用向量搜索在这些文档中检索
        FileDetailEntity fileEntity = fileDetailRepository.selectById(fileId);
        List<String> datasetIds = List.of(fileEntity.getDataSetId());

        return embeddingDomainService.ragDoc(datasetIds, question, maxResults, 0.5, true, 2, embeddingConfig, false); // 文件内检索暂时不启用查询扩展，保持现有行为
    }

    /** 构建检索文档的上下文 */
    private String buildContextFromDocuments(List<DocumentUnitEntity> documents) {
        if (documents.isEmpty()) {
            return "暂无相关文档信息。";
        }

        StringBuilder context = new StringBuilder();
        context.append("以下是相关的文档片段：\n\n");

        for (int i = 0; i < documents.size(); i++) {
            DocumentUnitEntity doc = documents.get(i);
            context.append(String.format("文档片段 %d：\n", i + 1));
            context.append(doc.getContent());
            context.append("\n\n");
        }

        return context.toString();
    }

    /** 构建RAG提示词 */
    private String buildRagPrompt(String question, String context) {
        return String.format(
                "请基于以下提供的文档内容回答用户的问题。如果文档中没有相关信息，请诚实地告知用户。\n\n" + "文档内容：\n%s\n\n" + "用户问题：%s\n\n" + "请提供准确、有帮助的回答：",
                context, question);
    }

    private IntentResult classifyIntent(String question, String userId) {
        IntentResult fallback = IntentResult.fallback();
        try {
            String userDefaultModelId = userSettingsDomainService.getUserDefaultModelId(userId);
            if (userDefaultModelId == null) {
                return fallback;
            }

            ModelEntity model = llmDomainService.getModelById(userDefaultModelId);
            List<String> fallbackChain = userSettingsDomainService.getUserFallbackChain(userId);
            HighAvailabilityResult result = highAvailabilityDomainService.selectBestProvider(model, userId,
                    "rag-intent-" + userId, fallbackChain);
            ProviderEntity provider = result.getProvider();
            ModelEntity selectedModel = result.getModel();

            ChatModel chatModel = llmServiceFactory.getStrandClient(provider, selectedModel);
            SystemMessage systemMessage = new SystemMessage("""
你是RAG问答的意图识别器。请基于用户问题输出严格的JSON，不要输出其它内容。

可选意图枚举：
definition, howto, comparison, troubleshooting, lookup, summary, metrics, citation, other

JSON 示例：
{"intent":"howto","confidence":0.78}
""");
            UserMessage userMessage = new UserMessage(question);
            ChatResponse response = chatModel.chat(Arrays.asList(systemMessage, userMessage));
            String raw = response.aiMessage().text();

            IntentResult parsed = parseIntent(raw);
            return parsed != null ? parsed : fallback;
        } catch (Exception e) {
            log.warn("Intent detection failed: {}", e.getMessage());
            return fallback;
        }
    }

    private IntentResult parseIntent(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(raw, IntentResult.class);
        } catch (Exception ignored) {
            String json = extractJsonObject(raw);
            if (json == null) {
                return null;
            }
            try {
                return objectMapper.readValue(json, IntentResult.class);
            } catch (Exception e) {
                return null;
            }
        }
    }

    private String rewriteQuestion(String question, List<DocumentUnitEntity> documents, String userId) {
        try {
            String userDefaultModelId = userSettingsDomainService.getUserDefaultModelId(userId);
            if (userDefaultModelId == null) {
                return question;
            }

            ModelEntity model = llmDomainService.getModelById(userDefaultModelId);
            List<String> fallbackChain = userSettingsDomainService.getUserFallbackChain(userId);
            HighAvailabilityResult result = highAvailabilityDomainService.selectBestProvider(model, userId,
                    "rag-rewrite-" + userId, fallbackChain);
            ProviderEntity provider = result.getProvider();
            ModelEntity selectedModel = result.getModel();

            ChatModel chatModel = llmServiceFactory.getStrandClient(provider, selectedModel);
            String context = buildRewriteContext(documents);

            SystemMessage systemMessage = new SystemMessage("""
你是RAG语义改写助手，请基于提供的知识库片段对问题进行改写，使其更利于检索，但不得改变原意。
请输出严格的JSON，不要输出其它内容。

要求：
1. originalQuestion 必须等于用户原问题
2. rewrittenQuestion 为改写后的问题，保持中文表达

JSON 示例：
{"originalQuestion":"如何配置默认模型？","rewrittenQuestion":"在当前系统中如何设置默认模型配置？"}
""");

            UserMessage userMessage = new UserMessage("用户问题：\n" + question + "\n\n知识库片段：\n" + context);
            ChatResponse response = chatModel.chat(Arrays.asList(systemMessage, userMessage));
            String raw = response.aiMessage().text();

            RewriteResult parsed = parseRewrite(raw);
            if (parsed == null || parsed.rewrittenQuestion == null || parsed.rewrittenQuestion.isBlank()) {
                return question;
            }
            return parsed.rewrittenQuestion;
        } catch (Exception e) {
            log.warn("Rewrite failed: {}", e.getMessage());
            return question;
        }
    }

    private RewriteResult parseRewrite(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(raw, RewriteResult.class);
        } catch (Exception ignored) {
            String json = extractJsonObject(raw);
            if (json == null) {
                return null;
            }
            try {
                return objectMapper.readValue(json, RewriteResult.class);
            } catch (Exception e) {
                return null;
            }
        }
    }

    private String buildRewriteContext(List<DocumentUnitEntity> documents) {
        if (documents == null || documents.isEmpty()) {
            return "无相关片段。";
        }
        StringBuilder context = new StringBuilder();
        int count = Math.min(REWRITE_CONTEXT_MAX_DOCS, documents.size());
        for (int i = 0; i < count; i++) {
            String content = documents.get(i).getContent();
            if (content == null) {
                continue;
            }
            String snippet = content.length() > REWRITE_CONTEXT_MAX_CHARS
                    ? content.substring(0, REWRITE_CONTEXT_MAX_CHARS) + "..."
                    : content;
            context.append("- ").append(snippet).append("\n");
        }
        return context.toString();
    }

    private RelevanceCheckResult checkRelevanceForDatasets(List<String> datasetIds, String question,
            EmbeddingModelFactory.EmbeddingConfig embeddingConfig) {
        try {
            if (datasetIds == null || datasetIds.isEmpty()) {
                return new RelevanceCheckResult(false, 0.0, 0, new ArrayList<>());
            }
            List<DocumentUnitEntity> docs = embeddingDomainService.ragDoc(datasetIds, question,
                    RAG_RELEVANCE_MAX_RESULTS, RAG_RELEVANCE_MIN_SCORE, false, 1, embeddingConfig, false);
            return toRelevanceResult(docs);
        } catch (Exception e) {
            log.warn("Relevance check failed: {}", e.getMessage());
            return new RelevanceCheckResult(false, 0.0, 0, new ArrayList<>());
        }
    }

    private RelevanceCheckResult checkRelevanceForSnapshot(List<DocumentUnitEntity> documents, String question,
            EmbeddingModelFactory.EmbeddingConfig embeddingConfig) {
        try {
            List<DocumentUnitEntity> docs = filterAndRankSnapshotDocuments(documents, question,
                    RAG_RELEVANCE_MAX_RESULTS, embeddingConfig);
            return toRelevanceResult(docs);
        } catch (Exception e) {
            log.warn("Snapshot relevance check failed: {}", e.getMessage());
            return new RelevanceCheckResult(false, 0.0, 0, new ArrayList<>());
        }
    }

    private RelevanceCheckResult toRelevanceResult(List<DocumentUnitEntity> docs) {
        double maxScore = 0.0;
        for (DocumentUnitEntity doc : docs) {
            double score = doc.getSimilarityScore() != null ? doc.getSimilarityScore() : 0.0;
            if (score > maxScore) {
                maxScore = score;
            }
        }
        boolean relevant = !docs.isEmpty() && maxScore >= RAG_RELEVANCE_THRESHOLD;
        return new RelevanceCheckResult(relevant, maxScore, docs.size(), docs);
    }

    private QueryExpansionResult expandQueries(String question, List<DocumentUnitEntity> documents, String userId) {
        QueryExpansionResult fallback = QueryExpansionResult.empty();
        try {
            String userDefaultModelId = userSettingsDomainService.getUserDefaultModelId(userId);
            if (userDefaultModelId == null) {
                return fallback;
            }

            ModelEntity model = llmDomainService.getModelById(userDefaultModelId);
            List<String> fallbackChain = userSettingsDomainService.getUserFallbackChain(userId);
            HighAvailabilityResult result = highAvailabilityDomainService.selectBestProvider(model, userId,
                    "rag-expand-" + userId, fallbackChain);
            ProviderEntity provider = result.getProvider();
            ModelEntity selectedModel = result.getModel();

            ChatModel chatModel = llmServiceFactory.getStrandClient(provider, selectedModel);
            String context = buildRewriteContext(documents);

            SystemMessage systemMessage = new SystemMessage("""
你是RAG检索查询扩展器，请基于用户问题与知识库片段生成查询扩展。
请输出严格JSON，不要输出其它内容。

要求：
1. queries: 2-4条中文检索问句（不要包含原问题）
2. keywords: 3-6个中文关键词/短语

JSON 示例：
{"queries":["如何设置默认模型配置？","模型服务商的默认模型怎么选？"],"keywords":["默认模型","模型服务商","配置"]}
""");

            UserMessage userMessage = new UserMessage("用户问题：\n" + question + "\n\n知识库片段：\n" + context);
            ChatResponse response = chatModel.chat(Arrays.asList(systemMessage, userMessage));
            String raw = response.aiMessage().text();

            QueryExpansionResult parsed = parseQueryExpansion(raw);
            return parsed != null ? parsed : fallback;
        } catch (Exception e) {
            log.warn("Query expansion failed: {}", e.getMessage());
            return fallback;
        }
    }

    private QueryExpansionResult parseQueryExpansion(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(raw, QueryExpansionResult.class);
        } catch (Exception ignored) {
            String json = extractJsonObject(raw);
            if (json == null) {
                return null;
            }
            try {
                return objectMapper.readValue(json, QueryExpansionResult.class);
            } catch (Exception e) {
                return null;
            }
        }
    }

    private List<String> buildQueryList(String originalQuestion, String rewrittenQuestion,
            QueryExpansionResult expansion) {
        List<String> queries = new ArrayList<>();
        if (originalQuestion != null && !originalQuestion.isBlank()) {
            queries.add(originalQuestion);
        }
        if (rewrittenQuestion != null && !rewrittenQuestion.isBlank()
                && !rewrittenQuestion.equals(originalQuestion)) {
            queries.add(rewrittenQuestion);
        }
        if (expansion != null && expansion.queries != null) {
            for (String query : expansion.queries) {
                if (query != null && !query.isBlank() && !queries.contains(query)) {
                    queries.add(query);
                }
            }
        }
        if (expansion != null && expansion.keywords != null && !expansion.keywords.isEmpty()) {
            String keywordQuery = String.join(" ", expansion.keywords);
            if (!keywordQuery.isBlank() && !queries.contains(keywordQuery)) {
                queries.add(keywordQuery);
            }
        }
        return queries;
    }

    private String buildQuerySummary(QueryExpansionResult expansion, String original, String rewritten,
            String rewriteFlag) {
        if (expansion == null || expansion.queries == null || expansion.queries.isEmpty()) {
            return String.format("- 查询模式：单查询\n- 使用问题：%s", rewriteFlag.equals("是") ? rewritten : original);
        }
        List<String> parts = new ArrayList<>();
        parts.add(String.format("- 查询模式：多路检索（%d 条）", expansion.queries.size() + 1));
        parts.add(String.format("- 使用问题：%s", rewriteFlag.equals("是") ? rewritten : original));
        parts.add(String.format("- 扩展查询：%s", String.join("；", expansion.queries)));
        if (expansion.keywords != null && !expansion.keywords.isEmpty()) {
            parts.add(String.format("- 关键词：%s", String.join(" / ", expansion.keywords)));
        }
        return String.join("\n", parts);
    }

    private List<DocumentUnitEntity> retrieveWithMultipleQueries(List<String> datasetIds, List<String> queries,
            Integer maxResults, Double minScore, Boolean enableRerank,
            EmbeddingModelFactory.EmbeddingConfig embeddingConfig) {
        if (queries == null || queries.isEmpty()) {
            return new ArrayList<>();
        }
        java.util.Map<String, DocumentUnitEntity> merged = new java.util.HashMap<>();
        for (String query : queries) {
            List<DocumentUnitEntity> docs = embeddingDomainService.ragDoc(datasetIds, query, maxResults, minScore,
                    enableRerank, 2, embeddingConfig, false);
            for (DocumentUnitEntity doc : docs) {
                String id = doc.getId();
                double score = doc.getSimilarityScore() != null ? doc.getSimilarityScore() : 0.0;
                DocumentUnitEntity existing = merged.get(id);
                if (existing == null) {
                    merged.put(id, doc);
                } else {
                    double existingScore = existing.getSimilarityScore() != null ? existing.getSimilarityScore() : 0.0;
                    if (score > existingScore) {
                        existing.setSimilarityScore(score);
                    }
                }
            }
        }
        List<DocumentUnitEntity> mergedList = new ArrayList<>(merged.values());
        mergedList.sort((a, b) -> Double.compare(
                b.getSimilarityScore() != null ? b.getSimilarityScore() : 0.0,
                a.getSimilarityScore() != null ? a.getSimilarityScore() : 0.0));
        return applyDiversityLimit(mergedList, maxResults);
    }

    private List<DocumentUnitEntity> applyDiversityLimit(List<DocumentUnitEntity> documents, Integer maxResults) {
        if (documents == null || documents.isEmpty()) {
            return new ArrayList<>();
        }
        java.util.Map<String, Integer> perFileCount = new java.util.HashMap<>();
        List<DocumentUnitEntity> result = new ArrayList<>();
        int limit = maxResults != null ? maxResults : documents.size();
        for (DocumentUnitEntity doc : documents) {
            if (result.size() >= limit) {
                break;
            }
            String fileId = doc.getFileId();
            int count = perFileCount.getOrDefault(fileId, 0);
            if (count >= 2) {
                continue;
            }
            result.add(doc);
            perFileCount.put(fileId, count + 1);
        }
        return result;
    }

    private List<DocumentUnitEntity> filterAndRankSnapshotDocumentsMulti(List<DocumentUnitEntity> documents,
            List<String> queries, Integer maxResults, EmbeddingModelFactory.EmbeddingConfig embeddingConfig) {
        if (documents == null || documents.isEmpty() || queries == null || queries.isEmpty()) {
            return new ArrayList<>();
        }
        try {
            EmbeddingModel embeddingModel = embeddingModelFactory.createEmbeddingModel(embeddingConfig);
            List<Embedding> queryEmbeddings = new ArrayList<>();
            for (String query : queries) {
                if (query == null || query.isBlank()) {
                    continue;
                }
                queryEmbeddings.add(embeddingModel.embed(query).content());
            }
            if (queryEmbeddings.isEmpty()) {
                return new ArrayList<>();
            }

            List<DocumentWithScore> documentsWithScores = new ArrayList<>();
            for (DocumentUnitEntity doc : documents) {
                try {
                    Embedding docEmbedding = embeddingModel.embed(doc.getContent()).content();
                    double best = 0.0;
                    for (Embedding queryEmbedding : queryEmbeddings) {
                        double similarity = cosineSimilarity(queryEmbedding.vectorAsList(),
                                docEmbedding.vectorAsList());
                        if (similarity > best) {
                            best = similarity;
                        }
                    }
                    doc.setSimilarityScore(best);
                    documentsWithScores.add(new DocumentWithScore(doc, best));
                } catch (Exception e) {
                    log.warn("计算文档相似度失败: {}", e.getMessage());
                    doc.setSimilarityScore(0.0);
                    documentsWithScores.add(new DocumentWithScore(doc, 0.0));
                }
            }

            documentsWithScores.sort((a, b) -> Double.compare(b.score, a.score));
            int limit = maxResults != null
                    ? Math.min(maxResults, documentsWithScores.size())
                    : documentsWithScores.size();
            List<DocumentUnitEntity> ranked = documentsWithScores.stream().limit(limit)
                    .map(dws -> dws.document).collect(Collectors.toList());
            return applyDiversityLimit(ranked, maxResults);
        } catch (Exception e) {
            log.error("快照文档相关性过滤失败", e);
            int limit = maxResults != null ? Math.min(maxResults, documents.size()) : documents.size();
            return documents.subList(0, limit);
        }
    }

    private void sendEvidenceCoverage(SseEmitter emitter, String answer, List<DocumentUnitEntity> documents,
            EmbeddingModelFactory.EmbeddingConfig embeddingConfig) {
        if (answer == null || answer.isBlank() || documents == null || documents.isEmpty()) {
            return;
        }
        try {
            EmbeddingModel embeddingModel = embeddingModelFactory.createEmbeddingModel(embeddingConfig);
            List<DocumentUnitEntity> topDocs = documents.stream().limit(5).collect(Collectors.toList());
            List<Embedding> docEmbeddings = new ArrayList<>();
            for (DocumentUnitEntity doc : topDocs) {
                String content = doc.getContent();
                if (content == null || content.isBlank()) {
                    docEmbeddings.add(null);
                    continue;
                }
                docEmbeddings.add(embeddingModel.embed(content).content());
            }

            String[] sentences = answer.split("[。！？!?\\n]");
            int total = 0;
            int covered = 0;
            for (String sentence : sentences) {
                String trimmed = sentence.trim();
                if (trimmed.isBlank()) {
                    continue;
                }
                total++;
                Embedding sentEmbedding = embeddingModel.embed(trimmed).content();
                double best = 0.0;
                for (Embedding docEmbedding : docEmbeddings) {
                    if (docEmbedding == null) {
                        continue;
                    }
                    double sim = cosineSimilarity(sentEmbedding.vectorAsList(), docEmbedding.vectorAsList());
                    if (sim > best) {
                        best = sim;
                    }
                }
                if (best >= 0.6) {
                    covered++;
                }
            }
            if (total == 0) {
                return;
            }
            double ratio = (double) covered / total * 100.0;
            String summary = String.format("### 证据覆盖\n- 句子数：%d\n- 覆盖率：%.0f%%", total, ratio);
            sendSseData(emitter, AgentChatResponse.build("证据覆盖评估", MessageType.RAG_THINKING_PROGRESS));
            sendSseData(emitter, AgentChatResponse.build(summary, MessageType.RAG_THINKING_PROGRESS));
        } catch (Exception e) {
            log.warn("Evidence coverage failed: {}", e.getMessage());
        }
    }
    private String extractJsonObject(String raw) {
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return raw.substring(start, end + 1);
        }
        return null;
    }

    private void sendIntentRewriteToClient(SseEmitter emitter, IntentResult intent, String originalQuestion,
            String rewrittenQuestion, RelevanceCheckResult relevance, QueryExpansionResult expansion) {
        String original = (originalQuestion == null || originalQuestion.isBlank())
                ? "未知"
                : originalQuestion;
        String rewritten = (rewrittenQuestion == null || rewrittenQuestion.isBlank())
                ? original
                : rewrittenQuestion;

        String relevanceText = relevance != null && relevance.isRelevant
                ? "相关"
                : "不相关";
        double maxScore = relevance != null ? relevance.maxScore : 0.0;
        int docCount = relevance != null ? relevance.docCount : 0;

        String rewriteFlag = relevance != null && relevance.isRelevant ? "是" : "否";
        String queryLine = buildQuerySummary(expansion, original, rewritten, rewriteFlag);
        String summary = String.format(
                "### 相关性判断\n- 结果：%s\n- 最高相似度：%.2f（阈值 %.2f）\n- 召回数量：%d\n\n### 意图识别\n- 意图：%s\n- 置信度：%.2f\n\n### 语义改写\n- 是否改写：%s\n- 原问题：%s\n- 改写：%s\n\n### 检索策略\n%s",
                relevanceText, maxScore, RAG_RELEVANCE_THRESHOLD, docCount,
                intent.intent, intent.confidence, rewriteFlag, original, rewritten, queryLine);

        sendSseData(emitter, AgentChatResponse.build("意图识别与语义改写", MessageType.RAG_THINKING_START));
        sendSseData(emitter, AgentChatResponse.build(summary, MessageType.RAG_THINKING_PROGRESS));
        sendSseData(emitter, AgentChatResponse.build("完成", MessageType.RAG_THINKING_END));
    }

    private static class IntentResult {
        public String intent;
        public double confidence;

        static IntentResult fallback() {
            IntentResult result = new IntentResult();
            result.intent = "other";
            result.confidence = 0.0;
            return result;
        }
    }

    private static class RewriteResult {
        public String originalQuestion;
        public String rewrittenQuestion;
    }

    private static class RelevanceCheckResult {
        public boolean isRelevant;
        public double maxScore;
        public int docCount;
        public List<DocumentUnitEntity> documents;

        RelevanceCheckResult(boolean isRelevant, double maxScore, int docCount, List<DocumentUnitEntity> documents) {
            this.isRelevant = isRelevant;
            this.maxScore = maxScore;
            this.docCount = docCount;
            this.documents = documents;
        }
    }

    private static class QueryExpansionResult {
        public List<String> queries;
        public List<String> keywords;

        static QueryExpansionResult empty() {
            QueryExpansionResult result = new QueryExpansionResult();
            result.queries = new ArrayList<>();
            result.keywords = new ArrayList<>();
            return result;
        }
    }

    /** 生成流式回答并等待完成
     * @param prompt RAG提示词
     * @param userId 用户ID
     * @param emitter SSE连接 */
    private String generateStreamAnswerAndWait(String prompt, String userId, SseEmitter emitter) {
        try {
            log.info("开始生成RAG回答，用户: {}, 提示词长度: {}", userId, prompt.length());

            // 获取用户默认模型配置
            String userDefaultModelId = userSettingsDomainService.getUserDefaultModelId(userId);
            if (userDefaultModelId == null) {
                log.warn("用户 {} 未配置默认模型，使用临时简化响应", userId);
                generateMockStreamAnswer(emitter);
                return null;
            }

            ModelEntity model = llmDomainService.getModelById(userDefaultModelId);
            List<String> fallbackChain = userSettingsDomainService.getUserFallbackChain(userId);

            // 获取最佳服务商（支持高可用、降级）
            HighAvailabilityResult result = highAvailabilityDomainService.selectBestProvider(model, userId,
                    "rag-session-" + userId, fallbackChain);
            ProviderEntity provider = result.getProvider();
            ModelEntity selectedModel = result.getModel();

            // 创建流式LLM客户端
            StreamingChatModel streamingClient = llmServiceFactory.getStreamingClient(provider, selectedModel);

            // 创建Agent并启动流式处理
            Agent agent = buildStreamingAgent(streamingClient);
            TokenStream tokenStream = agent.chat(prompt);

            // 记录调用开始时间
            long startTime = System.currentTimeMillis();

            // 使用CompletableFuture来等待流式处理完成
            CompletableFuture<Void> streamComplete = new CompletableFuture<>();
            java.util.concurrent.atomic.AtomicReference<String> fullAnswerRef = new java.util.concurrent.atomic.AtomicReference<>();

            // 思维链状态跟踪
            final boolean[] thinkingStarted = {false};
            final boolean[] thinkingEnded = {false};
            final boolean[] hasThinkingProcess = {false};

            // 普通模型的流式处理方式
            tokenStream.onPartialResponse(fragment -> {
                log.debug("收到响应片段: {}", fragment);

                // 如果有思考过程但还没结束思考，先结束思考阶段
                if (hasThinkingProcess[0] && !thinkingEnded[0]) {
                    sendSseData(emitter, AgentChatResponse.build("思考完成", MessageType.RAG_THINKING_END));
                    thinkingEnded[0] = true;
                }

                // 如果没有思考过程且还没开始过思考，先发送思考开始和结束
                if (!hasThinkingProcess[0] && !thinkingStarted[0]) {
                    sendSseData(emitter, AgentChatResponse.build("开始思考...", MessageType.RAG_THINKING_START));
                    sendSseData(emitter, AgentChatResponse.build("思考完成", MessageType.RAG_THINKING_END));
                    thinkingStarted[0] = true;
                    thinkingEnded[0] = true;
                }

                sendSseData(emitter, AgentChatResponse.build(fragment, MessageType.RAG_ANSWER_PROGRESS));
            }).onPartialReasoning(reasoning -> {

                // 标记有思考过程
                hasThinkingProcess[0] = true;

                // 如果还没开始思考，发送思考开始
                if (!thinkingStarted[0]) {
                    sendSseData(emitter, AgentChatResponse.build("开始思考...", MessageType.RAG_THINKING_START));
                    thinkingStarted[0] = true;
                }

                // 发送思考进行中的状态（可选择是否发送思考内容）
                sendSseData(emitter, AgentChatResponse.build(reasoning, MessageType.RAG_THINKING_PROGRESS));
            }).onCompleteReasoning(completeReasoning -> {
                log.info("思维链生成完成，长度: {}", completeReasoning.length());
                log.info("完整思维链内容:\n{}", completeReasoning);
            }).onCompleteResponse(chatResponse -> {
                String fullAnswer = chatResponse.aiMessage().text();
                log.info("RAG回答生成完成，用户: {}, 响应长度: {}", userId, fullAnswer.length());
                log.info("完整RAG回答内容:\n{}", fullAnswer);
                fullAnswerRef.set(fullAnswer);

                // 上报调用成功结果
                long latency = System.currentTimeMillis() - startTime;
                highAvailabilityDomainService.reportCallResult(result.getInstanceId(), selectedModel.getId(), true,
                        latency, null);

                streamComplete.complete(null);
            }).onError(throwable -> {
                log.error("RAG stream answer generation error for user: {}", userId, throwable);
                sendSseData(emitter, createErrorResponse("回答生成失败: " + throwable.getMessage()));

                long latency = System.currentTimeMillis() - startTime;
                highAvailabilityDomainService.reportCallResult(result.getInstanceId(), selectedModel.getId(), false,
                        latency, throwable.getMessage());

                streamComplete.completeExceptionally(throwable);
            });

            // 启动流处理
            tokenStream.start();

            // 等待流式处理完成，最多等待30分钟
            try {
                streamComplete.get(30, java.util.concurrent.TimeUnit.MINUTES);
            } catch (java.util.concurrent.TimeoutException e) {
                log.warn("LLM流式响应超时，用户: {}", userId);
                sendSseData(emitter, createErrorResponse("响应超时"));
            } catch (Exception e) {
                log.error("等待LLM流式响应时发生错误，用户: {}", userId, e);
            }
            return fullAnswerRef.get();

        } catch (Exception e) {
            log.error("Error in RAG stream answer generation for user: {}", userId, e);
            sendSseData(emitter, createErrorResponse("回答生成失败: " + e.getMessage()));
            return null;
        }
    }

    /** 生成模拟流式回答（备用方案） */
    private void generateMockStreamAnswer(SseEmitter emitter) {
        try {
            // 模拟流式回答生成
            String[] responseFragments = {"根据检索到的文档内容，", "我可以为您提供以下回答：\n\n", "这是基于文档内容生成的回答。", "\n\n如需更详细的信息，",
                    "请提供更具体的问题。"};

            // 用于拼接完整回答
            StringBuilder fullMockAnswer = new StringBuilder();

            for (String fragment : responseFragments) {
                fullMockAnswer.append(fragment);
                sendSseData(emitter, AgentChatResponse.build(fragment, MessageType.RAG_ANSWER_PROGRESS));
                Thread.sleep(200);
            }

            log.info("完整模拟RAG回答内容:\n{}", fullMockAnswer);

        } catch (Exception e) {
            log.error("Error generating mock stream answer", e);
            sendSseData(emitter, createErrorResponse("回答生成失败: " + e.getMessage()));
        }
    }

    /**
     * 构建流式Agent
     * 初始化 QA RAG机器人的系统提示词
     * */
    private Agent buildStreamingAgent(StreamingChatModel streamingClient) {
        MessageWindowChatMemory memory = MessageWindowChatMemory.builder().maxMessages(10)
                .chatMemoryStore(new InMemoryChatMemoryStore()).build();
        memory.add(new SystemMessage("""
        You are a professional document Q&A assistant. Answer questions strictly based on the provided documents.
        
        Markdown formatting requirements:
        1. Use standard Markdown syntax.
        2. Use list items with " - " (a dash followed by a single space), not "*".
        3. Cite page numbers in square brackets, e.g., [Page: 1].
        4. Insert a blank line between major paragraphs.
        5. Use bold as **text**.
        6. Keep indentation consistent; do not over-indent list items.
        7. Do not insert extra blank lines between list items.
        8. Add appropriate level-2 headings when needed (## ...).
        
        Language policy:
        - By default, reply in the same language as the user’s message (including headings, lists, and section titles).
        - If the user explicitly specifies a language (e.g., “Answer in English”, “请用中文回答”) or the message starts with a tag like [LANG=<code>] (e.g., [LANG=en], [LANG=zh]), respond strictly in that language until the user changes it.
        - If the user specifies Chinese or writes in Chinese, respond in Chinese. Do not mix languages unless the user asks for it.
        - Preserve quotations from the source documents in their original language; when helpful, add a brief parenthetical gloss in the user’s language.
        - Keep code, variable names, and proper nouns as-is.
        
        Answer structure:
        1. A brief introductory sentence.
        2. The main content as a list.
        3. An “Information Sources” section summarizing the pages used and their contributions.
        """));

        return AiServices.builder(Agent.class).streamingChatModel(streamingClient).chatMemory(memory).build();
    }

    /** 发送SSE数据（带状态检查） */
    private void sendSseData(SseEmitter emitter, AgentChatResponse response) {
        try {
            String jsonData = objectMapper.writeValueAsString(response);
            emitter.send(SseEmitter.event().data(jsonData));
        } catch (Exception e) {
            log.error("发送SSE数据失败", e);
        }
    }

    /** 创建错误响应 */
    private AgentChatResponse createErrorResponse(String errorMessage) {
        AgentChatResponse response = AgentChatResponse.buildEndMessage(errorMessage, MessageType.TEXT);
        return response;
    }

    /** 将ModelConfig转换为EmbeddingModelFactory.EmbeddingConfig
     * 
     * @param modelConfig RAG模型配置
     * @return 嵌入模型工厂配置 */
    private EmbeddingModelFactory.EmbeddingConfig toEmbeddingConfig(ModelConfig modelConfig) {
        return new EmbeddingModelFactory.EmbeddingConfig(modelConfig.getApiKey(), modelConfig.getBaseUrl(),
                modelConfig.getModelId());
    }

    /** 检索到的文档信息（内部类） */
    private static class RetrievedDocument {
        private String fileId;
        private String fileName;
        private String documentId;
        private Integer page;
        private Double score;
        private String snippet;

        public RetrievedDocument() {
        }

        public RetrievedDocument(String fileId, String fileName, String documentId, Double score, Integer page,
                String snippet) {
            this.fileId = fileId;
            this.fileName = fileName;
            this.documentId = documentId;
            this.score = score;
            this.page = page;
            this.snippet = snippet;
        }

        public String getFileId() {
            return fileId;
        }

        public void setFileId(String fileId) {
            this.fileId = fileId;
        }

        public String getFileName() {
            return fileName;
        }

        public void setFileName(String fileName) {
            this.fileName = fileName;
        }

        public String getDocumentId() {
            return documentId;
        }

        public void setDocumentId(String documentId) {
            this.documentId = documentId;
        }

        public Double getScore() {
            return score;
        }

        public void setScore(Double score) {
            this.score = score;
        }

        public Integer getPage() {
            return page;
        }

        public void setPage(Integer page) {
            this.page = page;
        }

        public String getSnippet() {
            return snippet;
        }

        public void setSnippet(String snippet) {
            this.snippet = snippet;
        }
    }

    private String buildSnippet(String content) {
        if (content == null) {
            return null;
        }
        String cleaned = content.replaceAll("\\s+", " ").trim();
        if (cleaned.length() > 160) {
            return cleaned.substring(0, 160) + "...";
        }
        return cleaned;
    }

    /** 基于已安装知识库的RAG流式问答
     * 
     * @param request 流式问答请求
     * @param userRagId 用户RAG安装记录ID
     * @param userId 用户ID
     * @return SSE流式响应 */
    public SseEmitter ragStreamChatByUserRag(RagStreamChatRequest request, String userRagId, String userId) {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);

        // 设置连接关闭回调
        emitter.onCompletion(
                () -> log.info("RAG stream chat by userRag completed for user: {}, userRagId: {}", userId, userRagId));
        emitter.onTimeout(() -> {
            log.warn("RAG stream chat by userRag timeout for user: {}, userRagId: {}", userId, userRagId);
            sendSseData(emitter, createErrorResponse("连接超时"));
        });
        emitter.onError((ex) -> {
            log.error("RAG stream chat by userRag connection error for user: {}, userRagId: {}", userId, userRagId, ex);
        });

        // 异步处理流式问答
        CompletableFuture.runAsync(() -> {
            try {
                processRagStreamChatByUserRag(request, userRagId, userId, emitter);
            } catch (Exception e) {
                log.error("RAG stream chat by userRag error", e);
                sendSseData(emitter, createErrorResponse("处理过程中发生错误: " + e.getMessage()));
            } finally {
                // 确保连接被正确关闭
                try {
                    emitter.complete();
                } catch (Exception e) {
                    log.warn("Error completing SSE emitter", e);
                }
            }
        });

        return emitter;
    }

    /** 处理基于用户RAG的流式问答核心逻辑 */
    private void processRagStreamChatByUserRag(RagStreamChatRequest request, String userRagId, String userId,
            SseEmitter emitter) {
        try {
            // 检查用户RAG是否存在和有权限访问
            if (!ragDataAccessService.canAccessRag(userId, userRagId)) {
                sendSseData(emitter, createErrorResponse("处理过程中发生错误: 数据集不存在"));
                return;
            }

            // 获取RAG数据源信息
            var dataSourceInfo = ragDataAccessService.getRagDataSourceInfo(userId, userRagId);
            log.info("Starting RAG stream chat by userRag: {}, user: {}, question: '{}', install type: {}", userRagId,
                    userId, request.getQuestion(), dataSourceInfo.getInstallType());

            // 意图识别与语义改写
            // 第一阶段：检索文档
            sendSseData(emitter, AgentChatResponse.build("开始检索相关文档...", MessageType.RAG_RETRIEVAL_START));
            Thread.sleep(500);

            // 获取用户的嵌入模型配置
            ModelConfig embeddingModelConfig = ragModelConfigService.getUserEmbeddingModelConfig(userId);
            EmbeddingModelFactory.EmbeddingConfig embeddingConfig = toEmbeddingConfig(embeddingModelConfig);

            List<DocumentUnitEntity> retrievedDocuments;
            String effectiveQuestion = request.getQuestion();
            IntentResult intentResult = classifyIntent(request.getQuestion(), userId);
            RelevanceCheckResult relevance;
            QueryExpansionResult expansion = QueryExpansionResult.empty();

            // 根据RAG类型选择不同的数据源
            if (dataSourceInfo.getIsRealTime()) {
                // REFERENCE类型：使用原始RAG的数据集进行向量搜索
                List<String> ragDatasetIds = List.of(dataSourceInfo.getOriginalRagId());
                relevance = checkRelevanceForDatasets(ragDatasetIds, request.getQuestion(), embeddingConfig);
                if (relevance.isRelevant) {
                    effectiveQuestion = rewriteQuestion(request.getQuestion(), relevance.documents, userId);
                    expansion = expandQueries(request.getQuestion(), relevance.documents, userId);
                }
                sendIntentRewriteToClient(emitter, intentResult, request.getQuestion(), effectiveQuestion, relevance,
                        expansion);

                List<String> queries = buildQueryList(request.getQuestion(), effectiveQuestion, expansion);
                retrievedDocuments = retrieveWithMultipleQueries(ragDatasetIds, queries, request.getMaxResults(),
                        request.getMinScore(), request.getEnableRerank(), embeddingConfig);
            } else {
                // SNAPSHOT类型：使用用户快照数据进行检索
                retrievedDocuments = ragDataAccessService.getRagDocuments(userId, userRagId);

                // 如果快照数据为空，返回空结果
                if (retrievedDocuments.isEmpty()) {
                    log.info("用户RAG [{}] 的快照数据为空，无法进行检索", userRagId);
                    relevance = new RelevanceCheckResult(false, 0.0, 0, new ArrayList<>());
                    sendIntentRewriteToClient(emitter, intentResult, request.getQuestion(), effectiveQuestion,
                            relevance, expansion);
                } else {
                    relevance = checkRelevanceForSnapshot(retrievedDocuments, request.getQuestion(), embeddingConfig);
                    if (relevance.isRelevant) {
                        effectiveQuestion = rewriteQuestion(request.getQuestion(), relevance.documents, userId);
                        expansion = expandQueries(request.getQuestion(), relevance.documents, userId);
                    }
                    sendIntentRewriteToClient(emitter, intentResult, request.getQuestion(), effectiveQuestion,
                            relevance, expansion);
                    // 对快照文档进行相关性过滤和排序
                    List<String> queries = buildQueryList(request.getQuestion(), effectiveQuestion, expansion);
                    retrievedDocuments = filterAndRankSnapshotDocumentsMulti(retrievedDocuments, queries,
                            request.getMaxResults(), embeddingConfig);
                }
            }

            // 构建检索结果
            List<RetrievedDocument> retrievedDocs = new ArrayList<>();

            if (dataSourceInfo.getIsRealTime()) {
                // REFERENCE类型：使用原始文件信息
                for (DocumentUnitEntity doc : retrievedDocuments) {
                    FileDetailEntity fileDetail = fileDetailRepository.selectById(doc.getFileId());
                    double similarityScore = doc.getSimilarityScore() != null ? doc.getSimilarityScore() : 0.0;
                    retrievedDocs.add(new RetrievedDocument(doc.getFileId(),
                            fileDetail != null ? fileDetail.getOriginalFilename() : "未知文件", doc.getId(),
                            similarityScore, doc.getPage(), buildSnippet(doc.getContent())));
                }
            } else {
                // SNAPSHOT类型：使用快照文件信息
                for (DocumentUnitEntity doc : retrievedDocuments) {
                    // doc.getFileId() 在SNAPSHOT模式下是 user_rag_files 的ID
                    UserRagFileEntity userFile = userRagFileRepository.selectById(doc.getFileId());
                    double similarityScore = doc.getSimilarityScore() != null ? doc.getSimilarityScore() : 0.0;
                    retrievedDocs.add(new RetrievedDocument(doc.getFileId(),
                            userFile != null ? userFile.getFileName() : "未知文件", doc.getId(), similarityScore,
                            doc.getPage(), buildSnippet(doc.getContent())));
                }
            }

            // 发送检索完成信号
            String retrievalMessage = String.format("检索完成，找到 %d 个相关文档", retrievedDocs.size());
            AgentChatResponse retrievalEndResponse = AgentChatResponse.build(retrievalMessage,
                    MessageType.RAG_RETRIEVAL_END);
            try {
                retrievalEndResponse.setPayload(objectMapper.writeValueAsString(retrievedDocs));
            } catch (Exception e) {
                log.error("Failed to serialize retrieved documents", e);
            }
            sendSseData(emitter, retrievalEndResponse);

            Thread.sleep(500);

            // 第二阶段：生成回答
            sendSseData(emitter, AgentChatResponse.build("开始生成回答...", MessageType.RAG_ANSWER_START));
            Thread.sleep(500);

            // 构建LLM上下文
            String context = buildContextFromDocuments(retrievedDocuments);
            String prompt = buildRagPrompt(effectiveQuestion, context);

            // 调用流式LLM - 使用同步等待确保流式处理完成
            String fullAnswer = generateStreamAnswerAndWait(prompt, userId, emitter);
            sendEvidenceCoverage(emitter, fullAnswer, retrievedDocuments, embeddingConfig);

            // 在LLM流式处理完成后发送完成信号
            sendSseData(emitter, AgentChatResponse.buildEndMessage("回答生成完成", MessageType.RAG_ANSWER_END));

        } catch (Exception e) {
            log.error("Error in processRagStreamChatByUserRag", e);
            sendSseData(emitter, createErrorResponse("处理过程中发生错误: " + e.getMessage()));
        }
    }

    /** 对快照文档进行相关性过滤和排序
     * 
     * @param documents 快照文档列表
     * @param question 用户问题
     * @param maxResults 最大返回数量
     * @param embeddingConfig 嵌入模型配置
     * @return 过滤和排序后的文档列表 */
    private List<DocumentUnitEntity> filterAndRankSnapshotDocuments(List<DocumentUnitEntity> documents, String question,
            Integer maxResults, EmbeddingModelFactory.EmbeddingConfig embeddingConfig) {

        if (documents == null || documents.isEmpty()) {
            return new ArrayList<>();
        }

        try {
            // 获取嵌入模型
            EmbeddingModel embeddingModel = embeddingModelFactory.createEmbeddingModel(embeddingConfig);

            // 计算问题的向量
            Embedding questionEmbedding = embeddingModel.embed(question).content();

            // 为每个文档计算相似度
            List<DocumentWithScore> documentsWithScores = new ArrayList<>();
            for (DocumentUnitEntity doc : documents) {
                try {
                    // 计算文档内容的向量
                    Embedding docEmbedding = embeddingModel.embed(doc.getContent()).content();

                    // 计算余弦相似度
                    double similarity = cosineSimilarity(questionEmbedding.vectorAsList(), docEmbedding.vectorAsList());

                    // 设置相似度分数到文档实体
                    doc.setSimilarityScore(similarity);
                    documentsWithScores.add(new DocumentWithScore(doc, similarity));

                } catch (Exception e) {
                    log.warn("计算文档相似度失败: {}", e.getMessage());
                    // 如果计算失败，设置较低的相似度分数
                    doc.setSimilarityScore(0.0);
                    documentsWithScores.add(new DocumentWithScore(doc, 0.0));
                }
            }

            // 按相似度降序排序
            documentsWithScores.sort((a, b) -> Double.compare(b.score, a.score));

            // 限制返回数量
            int limit = maxResults != null
                    ? Math.min(maxResults, documentsWithScores.size())
                    : documentsWithScores.size();

            return documentsWithScores.stream().limit(limit).map(dws -> dws.document).collect(Collectors.toList());

        } catch (Exception e) {
            log.error("快照文档相关性过滤失败", e);
            // 如果计算相似度失败，返回前N个文档
            int limit = maxResults != null ? Math.min(maxResults, documents.size()) : documents.size();
            return documents.subList(0, limit);
        }
    }

    /** 计算两个向量的余弦相似度 */
    private double cosineSimilarity(List<Float> vectorA, List<Float> vectorB) {
        if (vectorA.size() != vectorB.size()) {
            return 0.0;
        }

        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;

        for (int i = 0; i < vectorA.size(); i++) {
            dotProduct += vectorA.get(i) * vectorB.get(i);
            normA += Math.pow(vectorA.get(i), 2);
            normB += Math.pow(vectorB.get(i), 2);
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /** 文档与分数的内部类 */
    private static class DocumentWithScore {
        final DocumentUnitEntity document;
        final double score;

        DocumentWithScore(DocumentUnitEntity document, double score) {
            this.document = document;
            this.score = score;
        }
    }
}
