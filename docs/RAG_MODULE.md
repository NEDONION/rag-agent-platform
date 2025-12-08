# RAG 检索增强生成模块 - 详细技术文档

## 目录

- [模块概述](#模块概述)
- [核心功能](#核心功能)
- [技术架构](#技术架构)
- [数据库设计](#数据库设计)
- [文档处理流水线](#文档处理流水线)
- [向量检索引擎](#向量检索引擎)
- [版本化机制](#版本化机制)
- [状态机设计](#状态机设计)
- [性能优化](#性能优化)
- [配置说明](#配置说明)
- [最佳实践](#最佳实践)
- [故障排查](#故障排查)

---

## 模块概述

RAG（Retrieval-Augmented Generation）模块是 RAG Agent Platform 的核心模块之一，负责实现完整的文档处理、向量化存储、检索增强生成和版本化管理。

### 核心能力

- **多格式文档处理**: 支持 PDF、WORD、TXT、Markdown 等多种文档格式
- **智能 OCR 识别**: 基于 Vision LLM 的 PDF OCR，支持公式、表格、代码块识别
- **向量化存储**: 基于 PGVector 的高性能向量存储和检索
- **混合检索引擎**: 向量召回 + Rerank 精排 + 查询扩展
- **版本化管理**: 引用型（0.0.1）vs 快照型（≥1.0.0）双轨版本机制
- **进度追踪**: OCR 和向量化进度实时更新
- **异步处理**: 基于 RabbitMQ 的异步文档处理流水线

---

## 核心功能

### 1. 文档上传与存储

```java
// 文件上传接口
POST /api/rag/datasets/{datasetId}/upload
Content-Type: multipart/form-data

Request:
- file: MultipartFile（PDF/WORD/TXT/MD）
- datasetId: 知识库ID

Response:
{
  "fileId": "xxx",
  "fileName": "example.pdf",
  "size": 1024000,
  "status": "uploaded",
  "processingStatus": 0
}
```

### 2. 文档 OCR 处理

- **支持格式**: PDF、WORD、TXT、Markdown
- **处理策略**: 策略模式，根据文件类型选择不同处理策略
- **OCR 引擎**: Vision LLM（GPT-4V、Claude Vision 等）
- **特殊内容**: 支持数学公式（LaTeX）、表格、代码块识别

### 3. 向量化存储

- **向量模型**: 用户可配置 Embedding 模型
- **向量维度**: 1024（可配置）
- **存储引擎**: PGVector
- **元数据**: file_id、document_id、dataset_id、file_name

### 4. 检索增强生成

- **召回阶段**: 向量检索 + 元数据过滤 + 相似度阈值
- **精排阶段**: Rerank 模型重排序（bge-reranker-v2-m3）
- **查询扩展**: 自动获取相邻页面，保证上下文完整性
- **降级召回**: 相似度阈值过高时自动降低重试

### 5. 版本化管理

- **引用型（0.0.1）**: 实时同步原始数据，动态更新
- **快照型（≥1.0.0）**: 数据完全隔离，版本固化

---

## 技术架构

### 领域层结构

```
domain/rag/
├── consumer/                           # 消息队列消费者
│   ├── RagDocOcrConsumer.java         # OCR 处理消费者
│   └── RagDocStorageConsumer.java     # 向量化存储消费者
├── service/                            # 领域服务
│   ├── EmbeddingDomainService.java    # 向量嵌入服务
│   ├── RerankDomainService.java       # 重排序服务
│   ├── FileDetailDomainService.java   # 文件管理服务
│   ├── DocumentUnitDomainService.java # 文档单元服务
│   ├── RagDataAccessDomainService.java # RAG 数据访问服务
│   ├── FileProcessingStateMachineService.java # 文件处理状态机
│   └── UserRagSnapshotDomainService.java # 用户 RAG 快照服务
├── strategy/                           # 文档处理策略
│   ├── RagDocSyncOcrStrategy.java     # OCR 策略接口
│   ├── impl/
│   │   ├── PDFRagDocSyncOcrStrategyImpl.java   # PDF 处理策略
│   │   ├── WORDRagDocSyncOcrStrategyImpl.java  # WORD 处理策略
│   │   └── TXTRagDocSyncOcrStrategyImpl.java   # TXT 处理策略
│   └── context/
│       └── RagDocSyncOcrContext.java  # 策略上下文
├── model/                              # 领域实体
│   ├── FileDetailEntity.java          # 文件详情实体
│   ├── DocumentUnitEntity.java        # 文档单元实体
│   ├── RagQaDatasetEntity.java        # RAG 数据集实体
│   ├── RagVersionEntity.java          # RAG 版本实体
│   ├── UserRagEntity.java             # 用户 RAG 实体
│   ├── UserRagFileEntity.java         # 用户 RAG 文件实体
│   └── UserRagDocumentEntity.java     # 用户 RAG 文档实体
├── repository/                         # 仓储接口
│   ├── FileDetailRepository.java
│   ├── DocumentUnitRepository.java
│   ├── RagVersionRepository.java
│   └── UserRagRepository.java
├── message/                            # 消息对象
│   ├── RagDocSyncOcrMessage.java      # OCR 消息
│   └── RagDocSyncStorageMessage.java  # 向量化消息
└── constant/                           # 常量定义
    ├── FileProcessingStatusEnum.java   # 文件处理状态枚举
    ├── FileProcessingEventEnum.java    # 文件处理事件枚举
    └── InstallType.java                # 安装类型枚举
```

### 核心依赖

```xml
<!-- LangChain4j - AI 框架 -->
<dependency>
    <groupId>dev.langchain4j</groupId>
    <artifactId>langchain4j</artifactId>
    <version>1.0.4.3-beta7</version>
</dependency>

<!-- PGVector - 向量数据库 -->
<dependency>
    <groupId>dev.langchain4j</groupId>
    <artifactId>langchain4j-pgvector</artifactId>
    <version>1.0.4.3-beta7</version>
</dependency>

<!-- RabbitMQ - 消息队列 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>

<!-- Apache PDFBox - PDF 处理 -->
<dependency>
    <groupId>org.apache.pdfbox</groupId>
    <artifactId>pdfbox</artifactId>
    <version>3.0.2</version>
</dependency>

<!-- Apache POI - Office 文档处理 -->
<dependency>
    <groupId>org.apache.poi</groupId>
    <artifactId>poi-ooxml</artifactId>
    <version>5.4.0</version>
</dependency>

<!-- Apache Tika - 文件类型检测 -->
<dependency>
    <groupId>org.apache.tika</groupId>
    <artifactId>tika-core</artifactId>
    <version>2.6.0</version>
</dependency>
```

---

## 数据库设计

### 核心表结构

#### 1. 知识库表（ai_rag_qa_dataset）

```sql
CREATE TABLE ai_rag_qa_dataset (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64),                   -- 知识库名称
    icon VARCHAR(64),                   -- 知识库图标
    description VARCHAR(64),            -- 知识库描述
    user_id VARCHAR(64),                -- 创建者ID
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_rag_dataset_user_id ON ai_rag_qa_dataset(user_id);
```

#### 2. 文件详情表（file_detail）

```sql
CREATE TABLE file_detail (
    id VARCHAR(64) PRIMARY KEY,
    url TEXT,                                    -- 文件访问地址（对象存储URL）
    size BIGINT,                                 -- 文件大小（字节）
    filename VARCHAR(255),                       -- 文件名称
    original_filename VARCHAR(255),              -- 原始文件名
    ext VARCHAR(50),                             -- 文件扩展名
    platform VARCHAR(50),                        -- 存储平台（s3/qiniu）
    data_set_id VARCHAR,                         -- 所属知识库ID
    user_id VARCHAR,                             -- 用户ID
    file_page_size BIGINT,                       -- 文件总页数
    current_ocr_page_number INT DEFAULT 0,       -- 当前OCR处理页数
    current_embedding_page_number INT DEFAULT 0, -- 当前向量化处理页数
    ocr_process_progress NUMERIC(5,2) DEFAULT 0.00,        -- OCR进度(0-100)
    embedding_process_progress NUMERIC(5,2) DEFAULT 0.00,  -- 向量化进度(0-100)
    processing_status INT DEFAULT 0,             -- 文件处理状态
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- 索引优化
CREATE INDEX idx_file_detail_dataset ON file_detail(data_set_id);
CREATE INDEX idx_file_detail_user ON file_detail(user_id);
CREATE INDEX idx_file_detail_status ON file_detail(processing_status);
CREATE INDEX idx_file_detail_ocr_progress ON file_detail(ocr_process_progress);
CREATE INDEX idx_file_detail_embedding_progress ON file_detail(embedding_process_progress);
```

**文件处理状态（processing_status）**:

| 状态码 | 状态名称 | 说明 |
|-------|---------|-----|
| 0 | UPLOADED | 已上传 |
| 1 | OCR_PROCESSING | OCR处理中 |
| 2 | OCR_COMPLETED | OCR完成 |
| 3 | EMBEDDING_PROCESSING | 向量化处理中 |
| 4 | COMPLETED | 处理完成 |
| 5 | OCR_FAILED | OCR失败 |
| 6 | EMBEDDING_FAILED | 向量化失败 |

#### 3. 文档单元表（document_unit）

```sql
CREATE TABLE document_unit (
    id VARCHAR(64) PRIMARY KEY,
    file_id VARCHAR(64),              -- 关联文件ID
    page INT,                         -- 页码
    content TEXT,                     -- 文档内容
    is_ocr BOOLEAN,                   -- 是否完成OCR
    is_vector BOOLEAN NOT NULL,       -- 是否完成向量化
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_document_unit_file ON document_unit(file_id);
CREATE INDEX idx_document_unit_ocr ON document_unit(file_id, is_ocr);
CREATE INDEX idx_document_unit_vector ON document_unit(file_id, is_vector);
```

#### 4. RAG版本表（rag_versions）

```sql
CREATE TABLE rag_versions (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,              -- 快照时的名称
    description TEXT,                        -- 快照时的描述
    user_id VARCHAR(36) NOT NULL,            -- 创建者ID
    version VARCHAR(50) NOT NULL,            -- 版本号(如"1.0.0")
    change_log TEXT,                         -- 更新日志
    original_rag_id VARCHAR(36) NOT NULL,    -- 原始RAG数据集ID
    file_count INT DEFAULT 0,                -- 文件数量
    total_size BIGINT DEFAULT 0,             -- 总大小
    document_count INT DEFAULT 0,            -- 文档单元数量
    publish_status INT DEFAULT 1,            -- 发布状态
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_rag_versions_original ON rag_versions(original_rag_id);
CREATE INDEX idx_rag_versions_status ON rag_versions(publish_status);
```

#### 5. 用户RAG表（user_rags）

```sql
CREATE TABLE user_rags (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    original_rag_id VARCHAR(36) NOT NULL,    -- 原始RAG ID
    rag_version_id VARCHAR(36) NOT NULL,     -- 安装的版本ID
    install_type INT NOT NULL,               -- 安装类型(1:引用型, 2:快照型)
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_user_rags_user ON user_rags(user_id);
CREATE INDEX idx_user_rags_version ON user_rags(rag_version_id);
CREATE INDEX idx_user_rags_type ON user_rags(install_type);
```

### 向量存储表（PGVector）

```sql
-- LangChain4j 自动创建
CREATE TABLE langchain4j_pg_vector_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    embedding VECTOR(1024),              -- 向量（维度可配置）
    content TEXT,                        -- 文本内容
    metadata JSONB                       -- 元数据
);

-- 向量索引（IVFFlat）
CREATE INDEX ON langchain4j_pg_vector_store
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 元数据索引
CREATE INDEX ON langchain4j_pg_vector_store USING gin(metadata);
```

**元数据结构**:

```json
{
  "file_id": "xxx",         // 文件ID
  "file_name": "example.pdf", // 文件名
  "document_id": "xxx",     // 文档单元ID
  "dataset_id": "xxx"       // 数据集ID（引用型=原始ragId, 快照型=userRagId）
}
```

---

## 文档处理流水线

### 完整流程图

```
┌──────────────────────────────────────────────────────────────┐
│                    1. 文件上传阶段                            │
└──────────────────────────────────────────────────────────────┘
用户上传文件 (Frontend)
    ↓ HTTP POST /api/rag/datasets/{id}/upload
FileOperationAppService.uploadFile()
    ↓ 1.1 上传到对象存储 (S3/七牛云)
    ↓ 1.2 创建 file_detail 记录
    ↓     processing_status = 0 (已上传)
    ↓ 1.3 发送 RagDocSyncOcrEvent 到 RabbitMQ
    ↓
┌──────────────────────────────────────────────────────────────┐
│                    2. OCR处理阶段                             │
└──────────────────────────────────────────────────────────────┘
RagDocOcrConsumer.receiveMessage()
    ↓ 2.1 更新状态: processing_status = 1 (OCR处理中)
    ↓ 2.2 获取文件扩展名
    ↓ 2.3 选择处理策略
    ↓     - PDF  → PDFRagDocSyncOcrStrategyImpl
    ↓     - WORD → WORDRagDocSyncOcrStrategyImpl
    ↓     - TXT  → TXTRagDocSyncOcrStrategyImpl
    ↓ 2.4 执行OCR处理
    ↓     PDF: 逐页转Base64 → Vision LLM识别 → 后处理
    ↓     每处理一页更新进度: current_ocr_page_number++
    ↓ 2.5 保存 document_unit 记录
    ↓     is_ocr = true, is_vector = false
    ↓ 2.6 更新状态: processing_status = 2 (OCR完成)
    ↓ 2.7 自动触发向量化
    ↓
┌──────────────────────────────────────────────────────────────┐
│                    3. 向量化阶段                              │
└──────────────────────────────────────────────────────────────┘
autoStartVectorization()
    ↓ 3.1 查询所有 is_ocr=true & is_vector=false 的document_unit
    ↓ 3.2 更新状态: processing_status = 3 (向量化处理中)
    ↓ 3.3 为每个document_unit发送RagDocSyncStorageEvent
    ↓
RagDocStorageConsumer.receiveMessage()
    ↓ 3.4 获取document_unit内容
    ↓ 3.5 构建元数据 (file_id, document_id, dataset_id)
    ↓ 3.6 调用Embedding模型生成向量
    ↓ 3.7 存储到PGVector
    ↓     embeddingStore.add(embedding, textSegment)
    ↓ 3.8 更新document_unit: is_vector = true
    ↓ 3.9 更新进度: current_embedding_page_number++
    ↓ 3.10 检查是否所有页面完成
    ↓      若完成: processing_status = 4 (完成)
    ↓
完成
```

### OCR处理实现详解

#### PDF处理策略

**代码路径**: `PDFRagDocSyncOcrStrategyImpl.java`

```java
@Service("ragDocSyncOcr-PDF")
public class PDFRagDocSyncOcrStrategyImpl extends RagDocSyncOcrStrategyImpl {

    @Override
    public Map<Integer, String> processFile(byte[] fileBytes, int totalPages,
                                            RagDocSyncOcrMessage message) {
        Map<Integer, String> ocrData = new HashMap<>();

        for (int pageIndex = 0; pageIndex < totalPages; pageIndex++) {
            // 1. PDF页面转Base64图像
            String base64Image = PdfToBase64Converter.processPdfPageToBase64(
                fileBytes, pageIndex, "jpg"
            );

            // 2. 构建多模态消息
            UserMessage userMessage = UserMessage.userMessage(
                ImageContent.from(base64Image, "image/jpeg"),
                TextContent.from(OCR_PROMPT)
            );

            // 3. 调用Vision LLM进行OCR
            ChatModel ocrModel = createOcrModelFromMessage(message);
            ChatResponse response = ocrModel.chat(userMessage);

            // 4. 后处理：清理文本、修复LaTeX公式
            String cleanedText = processText(response.aiMessage().text());
            ocrData.put(pageIndex, cleanedText);

            // 5. 实时更新进度
            updateProcessProgress(pageIndex + 1, totalPages);

            // 6. 内存控制：每10页GC一次
            if ((pageIndex + 1) % 10 == 0) {
                System.gc();
            }

            // 7. 限流：避免API过载
            Thread.sleep(100);
        }

        return ocrData;
    }

    // OCR提示词
    private static final String OCR_PROMPT = """
        请识别图像中的所有文字内容，包括：
        1. 正文文字
        2. 数学公式（使用LaTeX格式，如 $E=mc^2$）
        3. 表格内容（保持表格结构）
        4. 代码块（使用代码围栏 ```language）
        请保持原有格式和结构，输出为Markdown格式。
        """;

    // 文本后处理：修复LaTeX转义
    private String processText(String input) {
        String result = input;
        result = result.replaceAll("\\\\（", "\\\\(");
        result = result.replaceAll("\\\\）", "\\\\)");
        result = result.replaceAll("\n{3,}", "\n\n");
        return result.trim();
    }

    // 进度更新
    private void updateProcessProgress(int currentPage, int totalPages) {
        double progress = (double) currentPage / totalPages * 100.0;

        fileDetailRepository.update(
            Wrappers.<FileDetailEntity>lambdaUpdate()
                .eq(FileDetailEntity::getId, currentProcessingFileId)
                .set(FileDetailEntity::getCurrentOcrPageNumber, currentPage)
                .set(FileDetailEntity::getOcrProcessProgress, progress)
        );
    }
}
```

**关键技术点**:

1. **逐页处理**: 避免一次加载整个PDF导致内存溢出
2. **Vision LLM OCR**: 使用多模态大模型（GPT-4V、Claude Vision），比传统OCR更准确
3. **LaTeX公式支持**: 自动识别数学公式并转换为LaTeX格式
4. **表格识别**: 保持表格结构
5. **内存控制**: 每10页执行一次GC
6. **进度追踪**: 实时更新数据库进度字段

#### WORD处理策略

**代码路径**: `WORDRagDocSyncOcrStrategyImpl.java`

```java
@Service("ragDocSyncOcr-WORD")
public class WORDRagDocSyncOcrStrategyImpl extends RagDocSyncOcrStrategyImpl {

    @Override
    public Map<Integer, String> processFile(byte[] fileBytes, int totalPages) {
        Map<Integer, String> ocrData = new HashMap<>();

        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(fileBytes))) {
            StringBuilder content = new StringBuilder();

            // 1. 提取段落文本
            List<XWPFParagraph> paragraphs = document.getParagraphs();
            for (XWPFParagraph para : paragraphs) {
                String text = para.getText();
                if (StringUtils.hasText(text)) {
                    content.append(text).append("\n");
                }
            }

            // 2. 提取表格内容
            List<XWPFTable> tables = document.getTables();
            for (XWPFTable table : tables) {
                content.append(extractTableContent(table)).append("\n");
            }

            // 3. WORD文档作为单页处理
            ocrData.put(0, content.toString());
        }

        return ocrData;
    }

    private String extractTableContent(XWPFTable table) {
        StringBuilder sb = new StringBuilder();
        sb.append("\n| ");

        for (XWPFTableRow row : table.getRows()) {
            for (XWPFTableCell cell : row.getTableCells()) {
                sb.append(cell.getText()).append(" | ");
            }
            sb.append("\n| ");
        }

        return sb.toString();
    }
}
```

### 向量化实现详解

**代码路径**: `EmbeddingDomainService.java`

```java
@Component
public class EmbeddingDomainService {

    private final EmbeddingStore<TextSegment> embeddingStore;
    private final EmbeddingModelFactory embeddingModelFactory;

    public void syncStorage(RagDocSyncStorageMessage message) {
        // 1. 获取文档单元
        DocumentUnitEntity documentUnit = documentUnitRepository.selectById(message.getId());

        // 2. 构建元数据
        Metadata metadata = new Metadata();
        metadata.put("file_id", message.getFileId());
        metadata.put("file_name", message.getFileName());
        metadata.put("document_id", message.getId());
        metadata.put("dataset_id", message.getDatasetId());

        // 3. 创建文本片段
        TextSegment textSegment = new TextSegment(documentUnit.getContent(), metadata);

        // 4. 调用Embedding模型生成向量
        OpenAiEmbeddingModel embeddingModel = createEmbeddingModelFromMessage(message);
        Embedding embedding = embeddingModel.embed(textSegment).content();

        // 5. 存储到PGVector
        embeddingStore.add(embedding, textSegment);

        // 6. 更新document_unit标记
        documentUnitRepository.update(
            Wrappers.lambdaUpdate(DocumentUnitEntity.class)
                .eq(DocumentUnitEntity::getId, documentUnit.getId())
                .set(DocumentUnitEntity::getIsVector, true)
        );
    }

    private OpenAiEmbeddingModel createEmbeddingModelFromMessage(RagDocSyncStorageMessage message) {
        var modelConfig = message.getEmbeddingModelConfig();

        EmbeddingModelFactory.EmbeddingConfig config =
            new EmbeddingModelFactory.EmbeddingConfig(
                modelConfig.getApiKey(),
                modelConfig.getBaseUrl(),
                modelConfig.getModelId()
            );

        return embeddingModelFactory.createEmbeddingModel(config);
    }
}
```

---

## 向量检索引擎

### 检索架构图

```
用户查询: "如何使用Docker部署应用？"
    ↓
┌─────────────────────────────────────────────────┐
│             召回阶段 (Recall)                    │
└─────────────────────────────────────────────────┘
    ↓ 1. 生成查询向量
EmbeddingModel.embed(query)
    ↓ 2. PGVector向量检索
embeddingStore.search(
    filter: dataset_id IN [...],
    maxResults: 30,  // candidateMultiplier * finalMaxResults
    minScore: 0.7
)
    ↓ 3. 获取30个候选文档
    ↓ 4. 降级召回（可选）
if (matches.isEmpty() && minScore > 0.3) {
    retry with minScore = 0.3
}
    ↓
┌─────────────────────────────────────────────────┐
│             精排阶段 (Rerank)                    │
└─────────────────────────────────────────────────┘
    ↓ 5. Rerank API重排序
rerankService.rerankDocument(
    model: "bge-reranker-v2-m3",
    query: "如何使用Docker部署应用？",
    documents: [30个候选文档]
)
    ↓ 6. 获取Top 15个文档
    ↓
┌─────────────────────────────────────────────────┐
│           查询扩展 (Query Expansion)             │
└─────────────────────────────────────────────────┘
    ↓ 7. 获取相邻页面（可选）
for each doc in Top15:
    adjacent = getAdjacentPages(doc.fileId, doc.page - 1, doc.page + 1)
    finalDocs.addAll(adjacent)
    ↓ 8. 返回15-45个文档片段
返回结果
```

### 检索核心代码

**代码路径**: `EmbeddingDomainService.java:76-239`

```java
public List<DocumentUnitEntity> ragDoc(
        List<String> dataSetIds,           // 知识库ID列表
        String question,                   // 用户查询
        Integer maxResults,                // 最大返回结果数（默认15）
        Double minScore,                   // 最小相似度阈值（默认0.7）
        Boolean enableRerank,              // 是否启用重排序（默认true）
        Integer candidateMultiplier,       // 候选结果倍数（默认2）
        EmbeddingConfig embeddingConfig,   // 嵌入模型配置
        Boolean enableQueryExpansion       // 是否启用查询扩展
) {
    // 参数验证和默认值设置
    int finalMaxResults = maxResults != null ? Math.min(maxResults, 100) : 15;
    double finalMinScore = minScore != null ? Math.max(0.0, Math.min(minScore, 1.0)) : 0.7;
    boolean finalEnableRerank = enableRerank != null ? enableRerank : true;
    int finalCandidateMultiplier = candidateMultiplier != null ?
        Math.max(1, Math.min(candidateMultiplier, 5)) : 2;

    // 创建嵌入模型
    OpenAiEmbeddingModel embeddingModel = embeddingModelFactory.createEmbeddingModel(embeddingConfig);

    // 向量查询（召回阶段）
    int searchLimit = finalEnableRerank
        ? Math.max(finalMaxResults * finalCandidateMultiplier, 30)
        : finalMaxResults;

    EmbeddingSearchResult<TextSegment> searchResult = embeddingStore.search(
        EmbeddingSearchRequest.builder()
            .filter(new IsIn("dataset_id", dataSetIds))
            .maxResults(searchLimit)
            .minScore(finalMinScore)
            .queryEmbedding(Embedding.from(embeddingModel.embed(question).content().vector()))
            .build()
    );

    // 重排序（精排阶段）
    List<EmbeddingMatch<TextSegment>> matches;
    if (finalEnableRerank && !searchResult.matches().isEmpty()) {
        matches = rerankService.rerankDocument(searchResult, question);
    } else {
        matches = searchResult.matches();
    }

    // 降级召回
    if (matches.isEmpty() && finalMinScore > 0.3) {
        searchResult = embeddingStore.search(/* minScore = 0.3 */);
        matches = searchResult.matches();
    }

    // 提取文档ID和分数
    Map<String, Double> documentScores = new HashMap<>();
    List<String> documentIds = matches.stream()
        .limit(finalMaxResults)
        .map(match -> {
            String documentId = match.embedded().metadata().getString("document_id");
            documentScores.put(documentId, match.score());
            return documentId;
        })
        .toList();

    // 查询扩展
    List<String> finalDocumentIds = new ArrayList<>(documentIds);
    if (Boolean.TRUE.equals(enableQueryExpansion)) {
        List<DocumentUnitEntity> initialDocs = documentUnitRepository.selectList(
            Wrappers.lambdaQuery(DocumentUnitEntity.class)
                .in(DocumentUnitEntity::getId, documentIds)
        );

        Set<String> expandedIds = new LinkedHashSet<>(documentIds);
        for (DocumentUnitEntity doc : initialDocs) {
            // 查询相邻页面（前一页、当前页、后一页）
            List<DocumentUnitEntity> adjacentChunks = documentUnitRepository.selectList(
                Wrappers.<DocumentUnitEntity>lambdaQuery()
                    .eq(DocumentUnitEntity::getFileId, doc.getFileId())
                    .between(DocumentUnitEntity::getPage,
                        Math.max(1, doc.getPage() - 1),
                        doc.getPage() + 1)
                    .eq(DocumentUnitEntity::getIsVector, true)
            );
            adjacentChunks.forEach(chunk -> expandedIds.add(chunk.getId()));
        }
        finalDocumentIds = new ArrayList<>(expandedIds);
    }

    // 查询所有文档并按相关性排序
    List<DocumentUnitEntity> allDocuments = documentUnitRepository.selectList(
        Wrappers.lambdaQuery(DocumentUnitEntity.class)
            .in(DocumentUnitEntity::getId, finalDocumentIds)
    );

    return finalDocumentIds.stream()
        .map(id -> {
            DocumentUnitEntity doc = allDocuments.stream()
                .filter(d -> id.equals(d.getId()))
                .findFirst()
                .orElse(null);

            if (doc != null) {
                Double score = documentScores.get(id);
                doc.setSimilarityScore(score != null ? score : finalMinScore * 0.8);
            }
            return doc;
        })
        .filter(Objects::nonNull)
        .toList();
}
```

### Rerank重排序

**代码路径**: `RerankDomainService.java`

```java
@Service
public class RerankDomainService {

    @Resource
    private RerankForestApi rerankForestApi;

    @Resource
    private RerankProperties rerankProperties;

    public List<EmbeddingMatch<TextSegment>> rerankDocument(
            EmbeddingSearchResult<TextSegment> searchResult,
            String question) {

        // 1. 提取候选文档文本
        List<String> documents = searchResult.matches().stream()
            .map(match -> match.embedded().text())
            .toList();

        // 2. 构建Rerank请求
        RerankRequest request = new RerankRequest();
        request.setModel(rerankProperties.getModel());  // bge-reranker-v2-m3
        request.setQuery(question);
        request.setDocuments(documents);

        // 3. 调用Rerank API
        RerankResponse response = rerankForestApi.rerank(
            rerankProperties.getApiUrl(),
            rerankProperties.getApiKey(),
            request
        );

        // 4. 按Rerank分数重新排序
        List<EmbeddingMatch<TextSegment>> rerankedMatches = new ArrayList<>();
        for (RerankResponse.SearchResult result : response.getResults()) {
            rerankedMatches.add(searchResult.matches().get(result.getIndex()));
        }

        return rerankedMatches;
    }
}
```

---

## 版本化机制

### 双轨版本架构

```
知识库生命周期:

1. 用户创建知识库
   ↓
   ai_rag_qa_dataset (id=rag1, name="机器学习知识库")

2. 用户上传文件并处理
   ↓
   file_detail + document_unit (原始数据)

3. 用户发布版本1.0.0
   ↓
   rag_versions (id=v1, version="1.0.0", original_rag_id=rag1)
   ├─ rag_version_files (复制file_detail)
   └─ rag_version_documents (复制document_unit)

4. 其他用户安装知识库
   ↓
   [引用型安装 (version=0.0.1)]
   user_rags (install_type=REFERENCE, original_rag_id=rag1)
   ├─ 数据访问: 直接查询 ai_rag_qa_dataset
   ├─ 向量检索: dataset_id = rag1
   └─ 数据更新: 实时同步原始数据

   [快照型安装 (version=1.0.0)]
   user_rags (install_type=SNAPSHOT, rag_version_id=v1)
   ├─ user_rag_files (复制到用户空间)
   ├─ user_rag_documents (复制到用户空间)
   ├─ 向量重新嵌入: dataset_id = userRagId
   └─ 数据独立: 不受原始数据变更影响
```

### 引用型 vs 快照型对比

| 特性 | 引用型 (REFERENCE) | 快照型 (SNAPSHOT) |
|-----|-------------------|------------------|
| **版本号** | 固定为 `0.0.1` | `>= 1.0.0` |
| **数据存储** | 引用原始数据集 | 完全复制到用户空间 |
| **数据表** | ai_rag_qa_dataset | user_rag_files + user_rag_documents |
| **向量存储** | 共享原始向量 | 独立向量副本 |
| **metadata.dataset_id** | 原始 ragId | userRagId |
| **数据更新** | 实时同步 | 版本固化 |
| **存储成本** | 低（共享） | 高（独立副本） |
| **数据隔离** | 低 | 高 |
| **适用场景** | 协作知识库、动态更新 | 稳定版本发布、数据隔离 |

### 快照创建实现

**代码路径**: `UserRagSnapshotDomainService.java`

```java
@Service
public class UserRagSnapshotDomainService {

    @Transactional
    public UserRagEntity createSnapshotInstall(String userId, String ragVersionId) {
        // 1. 获取RAG版本信息
        RagVersionEntity ragVersion = ragVersionRepository.selectById(ragVersionId);

        // 2. 创建用户RAG记录
        UserRagEntity userRag = new UserRagEntity();
        userRag.setUserId(userId);
        userRag.setRagVersionId(ragVersionId);
        userRag.setOriginalRagId(ragVersion.getOriginalRagId());
        userRag.setInstallType(InstallType.SNAPSHOT);
        userRagRepository.insert(userRag);

        // 3. 复制版本文件到用户空间
        List<RagVersionFileEntity> versionFiles = ragVersionFileRepository.selectList(
            Wrappers.<RagVersionFileEntity>lambdaQuery()
                .eq(RagVersionFileEntity::getRagVersionId, ragVersionId)
        );

        for (RagVersionFileEntity versionFile : versionFiles) {
            // 创建用户文件快照
            UserRagFileEntity userFile = new UserRagFileEntity();
            userFile.setUserRagId(userRag.getId());
            userFile.setOriginalFileId(versionFile.getOriginalFileId());
            userFile.setFileName(versionFile.getFileName());
            userRagFileRepository.insert(userFile);

            // 4. 复制文档单元到用户空间
            List<RagVersionDocumentEntity> versionDocuments = ragVersionDocumentRepository.selectList(
                Wrappers.<RagVersionDocumentEntity>lambdaQuery()
                    .eq(RagVersionDocumentEntity::getRagVersionFileId, versionFile.getId())
            );

            for (RagVersionDocumentEntity versionDoc : versionDocuments) {
                UserRagDocumentEntity userDoc = new UserRagDocumentEntity();
                userDoc.setUserRagId(userRag.getId());
                userDoc.setUserRagFileId(userFile.getId());
                userDoc.setContent(versionDoc.getContent());
                userRagDocumentRepository.insert(userDoc);

                // 5. 重新向量化到PGVector（使用userRagId作为dataset_id）
                reEmbedDocumentToUserSpace(userDoc, userRag, userId);
            }
        }

        return userRag;
    }
}
```

---

## 状态机设计

### 状态转换图

```
                startOcr()
UPLOADED(0) ────────────→ OCR_PROCESSING(1)
                              │
                              │ completeOcr()
                              ↓
                         OCR_COMPLETED(2)
                              │
                              │ startEmbedding()
                              ↓
                    EMBEDDING_PROCESSING(3)
                              │
                              │ completeEmbedding()
                              ↓
                         COMPLETED(4)

异常路径:
OCR_PROCESSING(1) ──failOcr()──→ OCR_FAILED(5)
EMBEDDING_PROCESSING(3) ──failEmbedding()──→ EMBEDDING_FAILED(6)
```

### 状态机实现

**代码路径**: `FileProcessingStateMachineService.java`

```java
@Service
public class FileProcessingStateMachineService {

    private final Map<FileProcessingStatusEnum, FileProcessingStateProcessor> stateProcessors;

    public boolean startOcrProcessing(String fileId, String userId) {
        return handleEvent(fileId, userId, FileProcessingEventEnum.START_OCR);
    }

    public boolean completeOcrProcessing(String fileId, String userId) {
        return handleEvent(fileId, userId, FileProcessingEventEnum.COMPLETE_OCR);
    }

    private boolean handleEvent(String fileId, String userId, FileProcessingEventEnum event) {
        // 1. 获取当前状态
        FileDetailEntity file = fileDetailRepository.selectById(fileId);
        FileProcessingStatusEnum currentStatus =
            FileProcessingStatusEnum.fromCode(file.getProcessingStatus());

        // 2. 获取状态处理器
        FileProcessingStateProcessor processor = stateProcessors.get(currentStatus);

        // 3. 检查是否可以处理该事件
        if (!processor.canHandle(event)) {
            log.warn("State {} cannot handle event {}", currentStatus, event);
            return false;
        }

        // 4. 执行状态转换
        FileProcessingStatusEnum nextStatus = processor.handle(fileId, userId, event);

        // 5. 更新数据库
        fileDetailRepository.update(
            Wrappers.lambdaUpdate(FileDetailEntity.class)
                .eq(FileDetailEntity::getId, fileId)
                .set(FileDetailEntity::getProcessingStatus, nextStatus.getCode())
        );

        return true;
    }
}
```

---

## 性能优化

### 1. 内存优化

```java
// PDF逐页处理
for (int pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    String base64 = PdfToBase64Converter.processPdfPageToBase64(fileBytes, pageIndex, "jpg");
    // 处理单页...

    // 每10页GC一次
    if ((pageIndex + 1) % 10 == 0) {
        System.gc();
    }
}
```

### 2. 向量检索优化

```sql
-- 创建IVFFlat索引
CREATE INDEX ON langchain4j_pg_vector_store
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 元数据索引
CREATE INDEX ON langchain4j_pg_vector_store USING gin(metadata);
```

### 3. 并发优化

- **消息队列**: 19个并发消费者
- **异步处理**: OCR和向量化并发执行
- **批量操作**: 批量插入document_unit

### 4. 缓存优化

```java
// 模型实例缓存
private final Map<String, OpenAiEmbeddingModel> modelCache = new ConcurrentHashMap<>();

public OpenAiEmbeddingModel getOrCreateModel(EmbeddingConfig config) {
    String key = config.getModelId();
    return modelCache.computeIfAbsent(key, k -> createModel(config));
}
```

---

## 配置说明

### application.yml

```yaml
# RabbitMQ配置
spring:
  rabbitmq:
    host: localhost
    port: 5672
    username: guest
    password: guest
    listener:
      simple:
        concurrency: 19  # 并发消费者数量
        max-concurrency: 19
        acknowledge-mode: manual  # 手动确认
        retry:
          enabled: true
          max-attempts: 3

# PGVector配置
langchain4j:
  pgvector:
    dimension: 1024  # 向量维度
    table-name: langchain4j_pg_vector_store
    distance-type: COSINE  # 相似度计算方式

# Rerank配置
rerank:
  api-url: https://api.siliconflow.cn/v1/rerank
  api-key: ${SILICONFLOW_API_KEY}
  model: bge-reranker-v2-m3
```

---

## 最佳实践

### 1. 文档上传

- **文件大小**: 建议单文件 < 50MB
- **支持格式**: PDF、WORD、TXT、Markdown
- **批量上传**: 支持，但建议单次 < 10个文件

### 2. RAG检索

```java
// 推荐参数配置
ragDoc(
    dataSetIds,
    question,
    maxResults = 15,           // 返回15个结果
    minScore = 0.7,            // 相似度阈值0.7
    enableRerank = true,       // 启用重排序
    candidateMultiplier = 2,   // 候选池扩充2倍
    enableQueryExpansion = true // 启用查询扩展
);
```

### 3. 版本管理

- **开发阶段**: 使用引用型（0.0.1），便于实时更新
- **生产发布**: 使用快照型（≥1.0.0），保证版本稳定

---

## 故障排查

### Q1: 文档处理失败（processing_status=5或6）

**检查步骤**:
```bash
# 1. 检查RabbitMQ是否正常
rabbitmqctl status

# 2. 查看消息队列积压
rabbitmqctl list_queues

# 3. 检查日志
tail -f logs/application.log | grep "OCR processing failed"

# 4. 检查模型API Key
echo $SILICONFLOW_API_KEY
```

### Q2: 向量检索无结果

**检查步骤**:
```sql
-- 1. 检查向量数据是否存在
SELECT COUNT(*) FROM langchain4j_pg_vector_store
WHERE metadata->>'dataset_id' = 'your_dataset_id';

-- 2. 检查相似度阈值是否过高
-- 建议降低 minScore 从 0.7 到 0.5

-- 3. 检查元数据过滤
SELECT metadata FROM langchain4j_pg_vector_store LIMIT 10;
```

### Q3: 内存溢出（OOM）

**解决方案**:
```bash
# 1. 增加JVM堆内存
java -Xmx4g -jar application.jar

# 2. 减少并发消费者
spring.rabbitmq.listener.simple.concurrency=10

# 3. 限制文件大小
max-file-size: 50MB
```

---

## 总结

RAG模块通过**异步处理流水线**、**混合检索引擎**、**双轨版本化机制**和**状态机驱动**，实现了一个高性能、高可用、易扩展的检索增强生成系统。

**核心优势**:

1. ✅ **多格式支持**: PDF/WORD/TXT/Markdown全覆盖
2. ✅ **智能OCR**: Vision LLM识别，支持公式、表格、代码块
3. ✅ **混合检索**: 向量召回 + Rerank精排 + 查询扩展
4. ✅ **版本化**: 引用型 vs 快照型双轨机制
5. ✅ **状态机**: 清晰的文件处理状态转换
6. ✅ **异步处理**: RabbitMQ解耦，19个并发消费者
7. ✅ **进度追踪**: OCR和向量化进度实时更新

**技术亮点**:

- **策略模式**: 文档处理易扩展
- **状态机模式**: 状态转换清晰可控
- **事件驱动**: 消息队列实现模块解耦
- **用户级配置**: 每个用户可配置自己的模型
- **向量隔离**: 快照型安装实现向量级别数据隔离

---

**相关文档**:

- [系统架构设计](./ARCHITECTURE.md)
- [Agent模块详解](./AGENT_MODULE.md)
- [数据库设计](./DATABASE.md)
- [API接口文档](./API.md)
