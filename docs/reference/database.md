# 数据库设计文档

## 1. 概述

RAG Agent Platform 采用 PostgreSQL 作为主数据库，利用其强大的 JSONB 支持、向量扩展 (PGVector) 和事务能力。数据库设计遵循**领域驱动设计 (DDD)** 原则，通过聚合根管理实体生命周期，确保数据一致性与业务完整性。

### 1.1 技术栈

- **数据库**: PostgreSQL 14+
- **向量扩展**: PGVector (向量相似度检索)
- **连接池**: HikariCP
- **ORM**: JPA + Hibernate
- **迁移工具**: Flyway / Liquibase

### 1.2 设计原则

1. **领域聚合**: 按业务领域划分表 (User、Agent、RAG、Tool、LLM)
2. **多租户隔离**: 核心表包含 `user_id` 字段实现租户级隔离
3. **软删除**: 使用 `deleted_at` 字段实现逻辑删除
4. **审计追踪**: 所有表包含 `created_at`、`updated_at` 字段
5. **JSONB 灵活性**: 使用 JSONB 存储动态配置与元数据
6. **索引优化**: 为高频查询字段添加索引

---

## 2. 数据库架构

### 2.1 模块划分

```
RAG Agent Platform 数据库
├── 用户模块 (User Domain)
│   ├── users (用户基础信息)
│   ├── user_balance (用户余额)
│   ├── user_tools (用户工具关联)
│   ├── user_rags (用户 RAG 关联)
│   └── user_containers (用户容器)
├── Agent 模块 (Agent Domain)
│   ├── agents (Agent 实体)
│   ├── agent_versions (Agent 版本)
│   ├── agent_workspace (Agent 工作区)
│   ├── agent_tasks (Agent 任务)
│   ├── agent_execution_summary (执行汇总)
│   └── agent_execution_details (执行详情)
├── RAG 模块 (RAG Domain)
│   ├── ai_rag_qa_dataset (知识库)
│   ├── file_detail (文件详情)
│   ├── document_unit (文档片段)
│   ├── rag_versions (RAG 版本)
│   └── embeddings (向量存储)
├── LLM 模块 (LLM Domain)
│   ├── providers (模型提供商)
│   ├── models (模型)
│   └── embeddings_models (向量模型)
├── 工具模块 (Tool Domain)
│   ├── tools (工具)
│   └── tool_versions (工具版本)
├── 对话模块 (Conversation Domain)
│   ├── sessions (会话)
│   └── messages (消息)
├── 计费模块 (Billing Domain)
│   ├── products (商品)
│   ├── orders (订单)
│   ├── usage_records (使用记录)
│   └── transactions (交易记录)
└── 系统模块 (System Domain)
    └── system_configs (系统配置)
```

### 2.2 核心实体关系

```
┌──────────┐
│  users   │────────┐
└────┬─────┘        │
     │1             │1
     │              │
     │*             │*
┌────┴────────┐ ┌──┴───────────┐
│   agents    │ │    tools     │
│             │ │              │
└────┬────────┘ └──────────────┘
     │1
     │
     │*
┌────┴──────────────┐
│  agent_versions   │
└───────────────────┘

┌──────────┐         ┌─────────────────┐
│  users   │1      * │   sessions      │
└────┬─────┘         └────┬────────────┘
     │1                   │1
     │                    │
     │*                   │*
┌────┴────────────┐  ┌───┴─────────────┐
│  ai_rag_qa_     │  │    messages     │
│  dataset        │  └─────────────────┘
└────┬────────────┘
     │1
     │
     │*
┌────┴────────────┐
│  file_detail    │
└────┬────────────┘
     │1
     │
     │*
┌────┴────────────┐
│  document_unit  │
└─────────────────┘
```

---

## 3. 用户模块

### 3.1 users (用户表)

**用途**: 存储用户基础信息与认证数据

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 用户唯一ID (UUID) |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名 |
| email | VARCHAR(100) | UNIQUE, NOT NULL | 邮箱 |
| password | VARCHAR(255) | NOT NULL | 加密密码 (BCrypt) |
| nickname | VARCHAR(50) | | 昵称 |
| avatar | VARCHAR(255) | | 头像URL |
| role | VARCHAR(20) | NOT NULL | 角色 (USER/ADMIN) |
| status | INTEGER | DEFAULT 1 | 状态 (1-正常, 2-禁用) |
| email_verified | BOOLEAN | DEFAULT false | 邮箱是否验证 |
| last_login_at | TIMESTAMP | | 最后登录时间 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

**安全设计**:
- 密码使用 BCrypt 加密 (成本因子: 10)
- 邮箱唯一性约束防止重复注册
- `deleted_at` 软删除保留用户历史数据

### 3.2 user_balance (用户余额表)

**用途**: 记录用户账户余额

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | BIGSERIAL | PK | 主键 |
| user_id | VARCHAR(64) | UNIQUE, NOT NULL | 用户ID |
| balance | NUMERIC(20,8) | DEFAULT 0 | 账户余额 (精确到小数点后8位) |
| frozen_balance | NUMERIC(20,8) | DEFAULT 0 | 冻结余额 |
| currency | VARCHAR(10) | DEFAULT 'CNY' | 货币类型 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE UNIQUE INDEX idx_user_balance_user_id ON user_balance(user_id);
```

**设计要点**:
- `NUMERIC(20,8)` 确保金额精度
- `frozen_balance` 用于预扣费场景 (如订单创建时冻结金额)
- 唯一索引确保一个用户只有一条余额记录

### 3.3 user_tools (用户工具关联表)

**用途**: 记录用户与工具的订阅关系

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 主键ID |
| user_id | VARCHAR(36) | NOT NULL | 用户ID |
| tool_id | VARCHAR(36) | NOT NULL | 工具ID |
| subscribed_at | TIMESTAMP | DEFAULT NOW() | 订阅时间 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_user_tools_user_id ON user_tools(user_id);
CREATE INDEX idx_user_tools_tool_id ON user_tools(tool_id);
```

### 3.4 user_rags (用户 RAG 关联表)

**用途**: 记录用户与 RAG 知识库的订阅关系

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 主键ID |
| user_id | VARCHAR(36) | NOT NULL | 用户ID |
| rag_id | VARCHAR(36) | NOT NULL | RAG ID |
| subscribed_at | TIMESTAMP | DEFAULT NOW() | 订阅时间 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_user_rags_user_id ON user_rags(user_id);
CREATE INDEX idx_user_rags_rag_id ON user_rags(rag_id);
```

### 3.5 user_containers (用户容器表)

**用途**: 管理用户的 MCP 容器实例

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 容器ID |
| name | VARCHAR(100) | NOT NULL | 容器名称 |
| user_id | VARCHAR(36) | NOT NULL | 用户ID |
| type | VARCHAR(255) | NOT NULL | 容器类型 (MCP_SERVER) |
| status | INTEGER | NOT NULL | 容器状态 (1-创建中, 2-运行中, 3-已停止, 4-错误, 5-删除中, 6-已删除) |
| image | VARCHAR(255) | | 容器镜像 |
| container_id | VARCHAR(255) | | Docker 容器ID |
| port | INTEGER | | 容器端口 |
| config | JSONB | | 容器配置 |
| error_message | TEXT | | 错误信息 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_user_containers_user_id ON user_containers(user_id);
CREATE INDEX idx_user_containers_status ON user_containers(status);
```

**状态流转**:
```
创建中 (1) → 运行中 (2) → 已停止 (3) → 删除中 (5) → 已删除 (6)
           ↓
        错误状态 (4)
```

---

## 4. Agent 模块

### 4.1 agents (Agent 实体表)

**用途**: 存储 Agent 的当前工作草稿

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | Agent 唯一ID |
| name | VARCHAR(255) | NOT NULL | Agent 名称 |
| avatar | VARCHAR(255) | | Agent 头像URL |
| description | TEXT | | Agent 描述 |
| system_prompt | TEXT | | 系统提示词 |
| welcome_message | TEXT | | 欢迎消息 |
| tool_ids | JSONB | | 工具ID列表 (JSON 数组) |
| knowledge_base_ids | JSONB | | 知识库ID列表 (JSON 数组) |
| tool_preset_params | JSONB | | 工具预设参数 (JSON 对象) |
| multi_modal | BOOLEAN | DEFAULT false | 是否支持多模态 |
| published_version | VARCHAR(36) | | 当前发布的版本ID |
| enabled | BOOLEAN | DEFAULT true | 是否启用 |
| user_id | VARCHAR(36) | NOT NULL | 创建者用户ID |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_agents_user_id ON agents(user_id);
```

**JSONB 字段示例**:
```json
{
  "tool_ids": ["tool-001", "tool-002"],
  "knowledge_base_ids": ["kb-001"],
  "tool_preset_params": {
    "weather_api": {
      "api_key": "xxx",
      "default_city": "北京"
    }
  }
}
```

### 4.2 agent_versions (Agent 版本表)

**用途**: 存储 Agent 的不可变发布版本

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 版本唯一ID |
| agent_id | VARCHAR(36) | NOT NULL | 关联的 Agent ID |
| name | VARCHAR(255) | NOT NULL | Agent 名称 (快照) |
| avatar | VARCHAR(255) | | Agent 头像 (快照) |
| description | TEXT | | Agent 描述 (快照) |
| version_number | VARCHAR(20) | NOT NULL | 版本号 (如 1.0.0) |
| system_prompt | TEXT | | 系统提示词 (快照) |
| welcome_message | TEXT | | 欢迎消息 (快照) |
| tool_ids | JSONB | | 工具ID列表 (快照) |
| knowledge_base_ids | JSONB | | 知识库ID列表 (快照) |
| tool_preset_params | JSONB | | 工具预设参数 (快照) |
| multi_modal | BOOLEAN | DEFAULT false | 是否支持多模态 |
| change_log | TEXT | | 版本更新日志 |
| publish_status | INTEGER | DEFAULT 1 | 发布状态 (1-审核中, 2-已发布, 3-拒绝, 4-已下架) |
| reject_reason | TEXT | | 审核拒绝原因 |
| review_time | TIMESTAMP | | 审核时间 |
| published_at | TIMESTAMP | | 发布时间 |
| user_id | VARCHAR(36) | NOT NULL | 创建者用户ID |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_agent_versions_agent_id ON agent_versions(agent_id);
CREATE INDEX idx_agent_versions_user_id ON agent_versions(user_id);
```

**版本化设计**:
- `agent_versions` 表存储不可变快照
- `agents.published_version` 指向当前线上版本
- 支持版本回滚: 修改 `published_version` 即可

### 4.3 agent_workspace (Agent 工作区表)

**用途**: 记录用户添加到工作区的 Agent

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 主键ID |
| agent_id | VARCHAR(36) | NOT NULL | Agent ID |
| user_id | VARCHAR(36) | NOT NULL | 用户ID |
| llm_model_config | JSONB | | 用户级模型配置覆盖 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_agent_workspace_agent_id ON agent_workspace(agent_id);
CREATE INDEX idx_agent_workspace_user_id ON agent_workspace(user_id);
```

**llm_model_config 示例**:
```json
{
  "model_id": "custom-model-001",
  "temperature": 0.7,
  "max_tokens": 2000
}
```

### 4.4 agent_tasks (Agent 任务表)

**用途**: 管理 Agent 的任务分解与执行

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 任务ID |
| session_id | VARCHAR(36) | NOT NULL | 所属会话ID |
| user_id | VARCHAR(36) | NOT NULL | 用户ID |
| parent_task_id | VARCHAR(36) | | 父任务ID (树形结构) |
| task_name | VARCHAR(255) | NOT NULL | 任务名称 |
| description | TEXT | | 任务描述 |
| status | VARCHAR(20) | | 任务状态 (pending/running/completed/failed) |
| progress | INTEGER | DEFAULT 0 | 任务进度 (0-100) |
| start_time | TIMESTAMP | | 开始时间 |
| end_time | TIMESTAMP | | 结束时间 |
| task_result | TEXT | | 任务结果 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_agent_tasks_session_id ON agent_tasks(session_id);
CREATE INDEX idx_agent_tasks_user_id ON agent_tasks(user_id);
CREATE INDEX idx_agent_tasks_parent_task_id ON agent_tasks(parent_task_id);
```

**树形结构查询**:
```sql
-- 查询任务树 (递归 CTE)
WITH RECURSIVE task_tree AS (
  SELECT * FROM agent_tasks WHERE id = 'root-task-id'
  UNION ALL
  SELECT t.* FROM agent_tasks t
  INNER JOIN task_tree tt ON t.parent_task_id = tt.id
)
SELECT * FROM task_tree;
```

### 4.5 agent_execution_summary (执行汇总表)

**用途**: 记录每次 Agent 执行的汇总信息

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | BIGSERIAL | PK | 主键 |
| trace_id | VARCHAR(64) | UNIQUE, NOT NULL | 执行追踪ID |
| user_id | VARCHAR(64) | NOT NULL | 用户ID |
| session_id | VARCHAR(64) | NOT NULL | 会话ID |
| agent_id | VARCHAR(64) | NOT NULL | Agent ID |
| execution_start_time | TIMESTAMP | NOT NULL | 执行开始时间 |
| execution_end_time | TIMESTAMP | | 执行结束时间 |
| total_execution_time | INTEGER | | 总执行时间 (毫秒) |
| total_input_tokens | INTEGER | DEFAULT 0 | 总输入 Token 数 |
| total_output_tokens | INTEGER | DEFAULT 0 | 总输出 Token 数 |
| total_tokens | INTEGER | DEFAULT 0 | 总 Token 数 |
| tool_call_count | INTEGER | DEFAULT 0 | 工具调用总次数 |
| total_tool_execution_time | INTEGER | DEFAULT 0 | 工具总执行时间 (毫秒) |
| total_cost | NUMERIC(10,6) | DEFAULT 0 | 总成本 |
| execution_success | BOOLEAN | NOT NULL | 执行是否成功 |
| error_phase | VARCHAR(64) | | 错误阶段 |
| error_message | TEXT | | 错误信息 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE UNIQUE INDEX agent_execution_summary_trace_id_key ON agent_execution_summary(trace_id);
CREATE INDEX idx_agent_exec_summary_user_time ON agent_execution_summary(user_id, execution_start_time);
CREATE INDEX idx_agent_exec_summary_session ON agent_execution_summary(session_id);
CREATE INDEX idx_agent_exec_summary_agent ON agent_execution_summary(agent_id);
```

### 4.6 agent_execution_details (执行详情表)

**用途**: 记录 Agent 执行的每个步骤详情

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | BIGSERIAL | PK | 主键 |
| trace_id | VARCHAR(64) | NOT NULL | 关联汇总表的追踪ID |
| sequence_no | INTEGER | NOT NULL | 执行序号 |
| step_type | VARCHAR(32) | NOT NULL | 步骤类型 (USER_MESSAGE/AI_RESPONSE/TOOL_CALL) |
| message_content | TEXT | | 消息内容 |
| message_type | VARCHAR(32) | | 消息类型 |
| model_id | VARCHAR(128) | | 使用的模型ID |
| provider_name | VARCHAR(64) | | 服务提供商 |
| message_tokens | INTEGER | | 消息 Token 数 |
| model_call_time | INTEGER | | 模型调用耗时 (毫秒) |
| tool_name | VARCHAR(128) | | 工具名称 |
| tool_request_args | TEXT | | 工具调用入参 (JSON) |
| tool_response_data | TEXT | | 工具调用出参 (JSON) |
| tool_execution_time | INTEGER | | 工具执行耗时 (毫秒) |
| tool_success | BOOLEAN | | 工具调用是否成功 |
| is_fallback_used | BOOLEAN | DEFAULT false | 是否触发模型降级 |
| fallback_reason | TEXT | | 降级原因 |
| fallback_from_model | VARCHAR(128) | | 降级前模型 |
| fallback_to_model | VARCHAR(128) | | 降级后模型 |
| step_cost | NUMERIC(10,6) | | 步骤成本 |
| step_success | BOOLEAN | NOT NULL | 步骤是否成功 |
| step_error_message | TEXT | | 步骤错误信息 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_agent_exec_details_trace_seq ON agent_execution_details(trace_id, sequence_no);
CREATE INDEX idx_agent_exec_details_trace_type ON agent_execution_details(trace_id, step_type);
CREATE INDEX idx_agent_exec_details_tool ON agent_execution_details(tool_name);
CREATE INDEX idx_agent_exec_details_model ON agent_execution_details(model_id);
```

**分区策略**:
```sql
-- 按月分区
CREATE TABLE agent_execution_details_2025_12 PARTITION OF agent_execution_details
FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
```

---

## 5. RAG 模块

### 5.1 ai_rag_qa_dataset (知识库表)

**用途**: 管理 RAG 知识库

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(64) | PK | 知识库ID |
| name | VARCHAR(64) | | 知识库名称 |
| icon | VARCHAR(64) | | 知识库图标 |
| description | VARCHAR(64) | | 知识库描述 |
| user_id | VARCHAR(64) | NOT NULL | 用户ID |
| type | VARCHAR(20) | | 类型 (PRIVATE/PUBLIC) |
| embedding_model_id | VARCHAR(64) | | 向量模型ID |
| published_version_id | VARCHAR(64) | | 当前发布的版本ID |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_ai_rag_qa_dataset_user_id ON ai_rag_qa_dataset(user_id);
```

### 5.2 file_detail (文件详情表)

**用途**: 记录上传文件的元数据与处理状态

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(64) | PK | 文件ID |
| rag_qa_dataset_id | VARCHAR(64) | NOT NULL | 所属知识库ID |
| name | VARCHAR(255) | NOT NULL | 文件名 |
| file_type | VARCHAR(20) | NOT NULL | 文件类型 (PDF/DOCX/TXT) |
| file_size | BIGINT | NOT NULL | 文件大小 (字节) |
| file_url | VARCHAR(512) | NOT NULL | 文件存储URL (OSS) |
| upload_status | INTEGER | NOT NULL | 上传状态 (1-上传中, 2-上传成功, 3-上传失败) |
| processing_status | INTEGER | | 处理状态 (1-等待处理, 2-处理中, 3-处理完成, 4-处理失败) |
| error_message | TEXT | | 错误信息 |
| metadata | JSONB | | 文件元数据 (页数、字符数等) |
| user_id | VARCHAR(64) | NOT NULL | 上传用户ID |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_file_detail_rag_qa_dataset_id ON file_detail(rag_qa_dataset_id);
CREATE INDEX idx_file_detail_user_id ON file_detail(user_id);
CREATE INDEX idx_file_detail_processing_status ON file_detail(processing_status);
```

**状态流转**:
```
上传中 (1) → 上传成功 (2) → 等待处理 (1) → 处理中 (2) → 处理完成 (3)
           ↓                                  ↓
      上传失败 (3)                         处理失败 (4)
```

### 5.3 document_unit (文档片段表)

**用途**: 存储文档分块后的片段

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | BIGSERIAL | PK | 片段ID |
| file_detail_id | VARCHAR(64) | NOT NULL | 所属文件ID |
| rag_qa_dataset_id | VARCHAR(64) | NOT NULL | 所属知识库ID |
| page_content | TEXT | NOT NULL | 片段文本内容 |
| page_number | INTEGER | | 页码 |
| chunk_index | INTEGER | | 分块索引 |
| metadata | JSONB | | 片段元数据 |
| embedding_id | VARCHAR(64) | | 关联的向量ID |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_document_unit_file_detail_id ON document_unit(file_detail_id);
CREATE INDEX idx_document_unit_rag_qa_dataset_id ON document_unit(rag_qa_dataset_id);
CREATE INDEX idx_document_unit_embedding_id ON document_unit(embedding_id);
```

**metadata 示例**:
```json
{
  "source": "report.pdf",
  "page": 5,
  "section": "第二章",
  "char_count": 500
}
```

### 5.4 embeddings (向量存储表)

**用途**: 存储文档片段的向量表示 (PGVector)

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(64) | PK | 向量ID |
| rag_qa_dataset_id | VARCHAR(64) | NOT NULL | 所属知识库ID |
| embedding_model_id | VARCHAR(64) | NOT NULL | 向量模型ID |
| vector | VECTOR(1024) | NOT NULL | 向量 (维度取决于模型) |
| metadata | JSONB | | 元数据 (关联 document_unit) |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_embeddings_rag_qa_dataset_id ON embeddings(rag_qa_dataset_id);

-- 向量索引 (IVFFlat 算法)
CREATE INDEX idx_embeddings_vector ON embeddings
USING ivfflat (vector vector_cosine_ops)
WITH (lists = 100);  -- lists 参数根据数据量调整
```

**向量检索查询**:
```sql
SELECT id, 1 - (vector <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM embeddings
WHERE rag_qa_dataset_id = 'rag-001'
ORDER BY vector <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

### 5.5 rag_versions (RAG 版本表)

**用途**: 管理知识库的版本快照

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(64) | PK | 版本ID |
| rag_qa_dataset_id | VARCHAR(64) | NOT NULL | 所属知识库ID |
| version_number | VARCHAR(20) | NOT NULL | 版本号 (如 0.0.1, 1.0.0) |
| version_type | INTEGER | NOT NULL | 版本类型 (1-引用型, 2-快照型) |
| description | TEXT | | 版本描述 |
| file_ids | JSONB | | 文件ID列表 (引用型版本使用) |
| snapshot_data | JSONB | | 快照数据 (快照型版本使用) |
| status | INTEGER | DEFAULT 1 | 状态 (1-草稿, 2-已发布) |
| user_id | VARCHAR(64) | NOT NULL | 创建者用户ID |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_rag_versions_rag_qa_dataset_id ON rag_versions(rag_qa_dataset_id);
CREATE INDEX idx_rag_versions_user_id ON rag_versions(user_id);
```

**版本类型**:
- **引用型 (0.0.x)**: `file_ids` 指向 `file_detail` 表，支持动态更新
- **快照型 (≥1.0.0)**: `snapshot_data` 存储完整快照，不可变

---

## 6. LLM 模块

### 6.1 providers (模型提供商表)

**用途**: 管理 LLM 服务提供商

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 提供商ID |
| user_id | VARCHAR(36) | | 用户ID (NULL 表示系统级) |
| name | VARCHAR(100) | NOT NULL | 提供商名称 |
| base_url | VARCHAR(255) | NOT NULL | API Base URL |
| api_key | VARCHAR(255) | NOT NULL | API Key (加密存储) |
| description | TEXT | | 描述 |
| is_official | BOOLEAN | DEFAULT false | 是否官方提供商 |
| status | BOOLEAN | DEFAULT true | 启用状态 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_providers_user_id ON providers(user_id);
```

**安全设计**:
- `api_key` 使用 AES 加密存储
- 支持用户级提供商配置

### 6.2 models (模型表)

**用途**: 管理可用的 LLM 模型

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 模型ID |
| user_id | VARCHAR(36) | | 用户ID (NULL 表示系统级) |
| provider_id | VARCHAR(36) | NOT NULL | 服务提供商ID |
| model_id | VARCHAR(100) | NOT NULL | 模型ID标识 (如 gpt-4) |
| name | VARCHAR(100) | NOT NULL | 模型名称 |
| model_endpoint | VARCHAR(255) | NOT NULL | 模型端点 |
| description | TEXT | | 模型描述 |
| is_official | BOOLEAN | DEFAULT false | 是否官方模型 |
| type | VARCHAR(20) | NOT NULL | 模型类型 (CHAT/COMPLETION/EMBEDDING) |
| status | BOOLEAN | DEFAULT true | 启用状态 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_models_provider_id ON models(provider_id);
CREATE INDEX idx_models_user_id ON models(user_id);
```

### 6.3 embeddings_models (向量模型表)

**用途**: 管理 Embedding 模型

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 模型ID |
| user_id | VARCHAR(36) | | 用户ID |
| provider_id | VARCHAR(36) | NOT NULL | 服务提供商ID |
| model_id | VARCHAR(100) | NOT NULL | 模型ID标识 |
| name | VARCHAR(100) | NOT NULL | 模型名称 |
| model_endpoint | VARCHAR(255) | NOT NULL | 模型端点 |
| description | TEXT | | 模型描述 |
| is_official | BOOLEAN | DEFAULT false | 是否官方模型 |
| dimension | INTEGER | NOT NULL | 向量维度 |
| max_input_length | INTEGER | | 最大输入长度 |
| status | BOOLEAN | DEFAULT true | 启用状态 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_embeddings_models_provider_id ON embeddings_models(provider_id);
CREATE INDEX idx_embeddings_models_user_id ON embeddings_models(user_id);
```

---

## 7. 工具模块

### 7.1 tools (工具表)

**用途**: 管理 MCP 工具

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 工具ID |
| name | VARCHAR(255) | NOT NULL | 工具名称 |
| icon | VARCHAR(255) | | 工具图标 |
| subtitle | VARCHAR(255) | | 副标题 |
| description | TEXT | | 工具描述 |
| user_id | VARCHAR(36) | NOT NULL | 用户ID |
| labels | JSONB | | 标签列表 (JSON 数组) |
| tool_type | VARCHAR(50) | NOT NULL | 工具类型 (MCP/API/FUNCTION) |
| upload_type | VARCHAR(20) | NOT NULL | 上传方式 (DOCKER/GITHUB/NPM) |
| upload_url | VARCHAR(255) | | 上传URL |
| install_command | JSONB | | 安装命令 (JSON 格式) |
| tool_list | JSONB | | 工具列表 (JSON 数组) |
| mcp_server_name | VARCHAR(255) | | MCP Server 名称 |
| status | VARCHAR(20) | NOT NULL | 审核状态 (pending/approved/rejected) |
| reject_reason | TEXT | | 审核拒绝原因 |
| failed_step_status | VARCHAR(20) | | 失败步骤状态 |
| is_office | BOOLEAN | DEFAULT false | 是否官方工具 |
| is_global | BOOLEAN | DEFAULT false | 是否全局工具 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_tools_user_id ON tools(user_id);
```

**tool_list 示例**:
```json
[
  {
    "name": "get_weather",
    "description": "获取天气信息",
    "input_schema": {
      "type": "object",
      "properties": {
        "city": {"type": "string"}
      }
    }
  }
]
```

### 7.2 tool_versions (工具版本表)

**用途**: 管理工具的版本

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 版本ID |
| tool_id | VARCHAR(36) | NOT NULL | 工具ID |
| name | VARCHAR(255) | NOT NULL | 工具名称 (快照) |
| icon | VARCHAR(255) | | 工具图标 (快照) |
| subtitle | VARCHAR(255) | | 副标题 (快照) |
| description | TEXT | | 工具描述 (快照) |
| user_id | VARCHAR(36) | NOT NULL | 用户ID |
| version | VARCHAR(50) | NOT NULL | 版本号 (如 1.0.0) |
| upload_type | VARCHAR(20) | NOT NULL | 上传方式 |
| change_log | TEXT | | 版本更新日志 |
| upload_url | VARCHAR(255) | | 上传URL (快照) |
| tool_list | JSONB | | 工具列表 (快照) |
| labels | JSONB | | 标签列表 (快照) |
| mcp_server_name | VARCHAR(255) | | MCP Server 名称 |
| is_office | BOOLEAN | DEFAULT false | 是否官方工具 |
| public_status | BOOLEAN | DEFAULT false | 公开状态 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_tool_versions_tool_id ON tool_versions(tool_id);
CREATE INDEX idx_tool_versions_user_id ON tool_versions(user_id);
```

---

## 8. 对话模块

### 8.1 sessions (会话表)

**用途**: 管理用户与 Agent 的对话会话

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 会话ID |
| title | VARCHAR(255) | NOT NULL | 会话标题 |
| user_id | VARCHAR(36) | NOT NULL | 用户ID |
| agent_id | VARCHAR(36) | | 关联的 Agent ID |
| description | TEXT | | 会话描述 |
| is_archived | BOOLEAN | DEFAULT false | 是否归档 |
| metadata | JSONB | | 会话元数据 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_agent_id ON sessions(agent_id);
```

### 8.2 messages (消息表)

**用途**: 存储会话中的消息

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 消息ID |
| session_id | VARCHAR(36) | NOT NULL | 所属会话ID |
| role | VARCHAR(20) | NOT NULL | 消息角色 (user/assistant/system) |
| content | TEXT | NOT NULL | 消息内容 |
| message_type | VARCHAR(20) | DEFAULT 'TEXT' | 消息类型 (TEXT/IMAGE/FILE) |
| token_count | INTEGER | DEFAULT 0 | Token 数量 |
| body_token_count | INTEGER | DEFAULT 0 | 消息本体 Token 数 |
| provider | VARCHAR(50) | | 服务提供商 |
| model | VARCHAR(50) | | 使用的模型 |
| metadata | JSONB | | 消息元数据 |
| file_urls | JSONB | | 附件URL列表 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_messages_session_id ON messages(session_id);
```

**metadata 示例**:
```json
{
  "tool_calls": [
    {
      "tool_name": "get_weather",
      "args": {"city": "北京"}
    }
  ],
  "rag_sources": ["doc-001", "doc-002"]
}
```

---

## 9. 计费模块

### 9.1 products (商品表)

**用途**: 定义计费商品

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(64) | PK | 商品ID |
| name | VARCHAR(255) | NOT NULL | 商品名称 |
| description | TEXT | | 商品描述 |
| type | VARCHAR(50) | NOT NULL | 商品类型 (RECHARGE/SUBSCRIPTION) |
| pricing_mode | VARCHAR(50) | NOT NULL | 定价模式 (FIXED/PAY_AS_YOU_GO) |
| unit_price | NUMERIC(20,8) | NOT NULL | 单价 |
| currency | VARCHAR(10) | DEFAULT 'CNY' | 货币类型 |
| metadata | JSONB | | 商品元数据 |
| status | INTEGER | DEFAULT 1 | 状态 (1-上架, 2-下架) |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

### 9.2 orders (订单表)

**用途**: 管理用户订单

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(64) | PK | 订单ID |
| user_id | VARCHAR(64) | NOT NULL | 用户ID |
| order_no | VARCHAR(100) | UNIQUE, NOT NULL | 订单号 |
| order_type | VARCHAR(50) | NOT NULL | 订单类型 (RECHARGE/PURCHASE/SUBSCRIPTION) |
| title | VARCHAR(255) | NOT NULL | 订单标题 |
| description | TEXT | | 订单描述 |
| amount | NUMERIC(20,8) | NOT NULL | 订单金额 |
| currency | VARCHAR(10) | DEFAULT 'CNY' | 货币类型 |
| status | INTEGER | DEFAULT 1 | 订单状态 (1-待支付, 2-已支付, 3-已取消, 4-已退款, 5-已过期) |
| expired_at | TIMESTAMP | | 订单过期时间 |
| paid_at | TIMESTAMP | | 支付完成时间 |
| cancelled_at | TIMESTAMP | | 取消时间 |
| refunded_at | TIMESTAMP | | 退款时间 |
| refund_amount | NUMERIC(20,8) | DEFAULT 0 | 退款金额 |
| payment_platform | VARCHAR(50) | | 支付平台 (alipay/wechat/stripe) |
| payment_type | VARCHAR(50) | | 支付类型 |
| payment_method | VARCHAR(50) | | 支付方式 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE UNIQUE INDEX idx_orders_order_no ON orders(order_no);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
```

### 9.3 usage_records (使用记录表)

**用途**: 记录用户的服务使用记录

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(64) | PK | 记录ID |
| user_id | VARCHAR(64) | NOT NULL | 用户ID |
| product_id | VARCHAR(64) | NOT NULL | 商品ID |
| quantity_data | JSONB | | 使用量数据 (如 Token 数) |
| cost | NUMERIC(20,8) | NOT NULL | 本次消费金额 |
| request_id | VARCHAR(255) | NOT NULL | 请求ID (幂等性保证) |
| billed_at | TIMESTAMP | DEFAULT NOW() | 计费时间 |
| service_name | VARCHAR(255) | | 服务名称 |
| service_type | VARCHAR(100) | | 服务类型 |
| service_description | TEXT | | 服务描述 |
| pricing_rule | TEXT | | 定价规则说明 |
| related_entity_name | VARCHAR(255) | | 关联实体名称 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_usage_records_user_id ON usage_records(user_id);
CREATE INDEX idx_usage_records_billed_at ON usage_records(billed_at);
CREATE UNIQUE INDEX idx_usage_records_request_id ON usage_records(request_id);
```

**quantity_data 示例**:
```json
{
  "input_tokens": 500,
  "output_tokens": 800,
  "total_tokens": 1300
}
```

### 9.4 transactions (交易记录表)

**用途**: 记录账户资金变动

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(64) | PK | 交易ID |
| user_id | VARCHAR(64) | NOT NULL | 用户ID |
| type | VARCHAR(50) | NOT NULL | 交易类型 (RECHARGE/DEDUCTION/REFUND) |
| amount | NUMERIC(20,8) | NOT NULL | 交易金额 (正数为增加,负数为扣减) |
| balance_before | NUMERIC(20,8) | NOT NULL | 交易前余额 |
| balance_after | NUMERIC(20,8) | NOT NULL | 交易后余额 |
| related_order_id | VARCHAR(64) | | 关联订单ID |
| related_usage_record_id | VARCHAR(64) | | 关联使用记录ID |
| description | TEXT | | 交易描述 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| deleted_at | TIMESTAMP | | 逻辑删除时间 |

**索引**:
```sql
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
```

---

## 10. 系统模块

### 10.1 system_configs (系统配置表)

**用途**: 存储系统级配置

| 字段 | 类型 | 约束 | 说明 |
|-----|------|------|------|
| id | VARCHAR(36) | PK | 配置ID |
| config_key | VARCHAR(100) | UNIQUE, NOT NULL | 配置键 |
| config_value | TEXT | NOT NULL | 配置值 |
| description | TEXT | | 配置描述 |
| value_type | VARCHAR(20) | DEFAULT 'STRING' | 值类型 (STRING/JSON/INTEGER/BOOLEAN) |
| is_public | BOOLEAN | DEFAULT false | 是否公开 (前端可读) |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |

**索引**:
```sql
CREATE UNIQUE INDEX idx_system_configs_key ON system_configs(config_key);
```

**配置示例**:
```sql
INSERT INTO system_configs (config_key, config_value, value_type, is_public)
VALUES
  ('max_upload_file_size', '100', 'INTEGER', true),
  ('default_llm_model', 'gpt-4-turbo', 'STRING', true),
  ('rag_default_chunk_size', '500', 'INTEGER', false);
```

---

## 11. 索引优化策略

### 11.1 索引设计原则

1. **高频查询字段**: 为 WHERE、JOIN、ORDER BY 字段添加索引
2. **复合索引**: 多字段查询使用复合索引 (注意顺序)
3. **覆盖索引**: 包含 SELECT 字段避免回表
4. **部分索引**: 为常用过滤条件创建部分索引

### 11.2 索引示例

```sql
-- 复合索引 (用户+时间范围查询)
CREATE INDEX idx_messages_user_time ON messages(user_id, created_at DESC);

-- 部分索引 (仅索引未删除记录)
CREATE INDEX idx_agents_active ON agents(user_id)
WHERE deleted_at IS NULL;

-- JSONB 索引 (GIN 索引)
CREATE INDEX idx_agents_tool_ids ON agents USING GIN (tool_ids);

-- 全文搜索索引
CREATE INDEX idx_agents_name_search ON agents USING GIN (to_tsvector('simple', name));
```

### 11.3 索引监控

```sql
-- 查看表索引使用情况
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- 查找未使用的索引
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelname NOT LIKE '%_pkey';
```

---

## 12. 查询优化

### 12.1 慢查询优化

```sql
-- 分页查询优化 (使用游标)
SELECT * FROM messages
WHERE session_id = 'session-123'
AND id > 'last-message-id'  -- 使用ID游标而非OFFSET
ORDER BY created_at DESC
LIMIT 50;

-- 避免 SELECT *
SELECT id, content, created_at FROM messages  -- 仅选择需要的字段
WHERE session_id = 'session-123';

-- 使用 EXPLAIN ANALYZE 分析查询
EXPLAIN ANALYZE
SELECT * FROM agent_execution_details
WHERE trace_id = 'trace-abc123';
```

### 12.2 批量操作优化

```sql
-- 批量插入
INSERT INTO document_unit (file_detail_id, page_content, chunk_index)
VALUES
  ('file-001', 'content1', 1),
  ('file-001', 'content2', 2),
  ('file-001', 'content3', 3)
ON CONFLICT DO NOTHING;

-- 批量更新 (使用 UPDATE FROM)
UPDATE file_detail SET processing_status = 3
FROM (VALUES ('file-001'), ('file-002')) AS v(id)
WHERE file_detail.id = v.id;
```

---

## 13. 数据备份与恢复

### 13.1 备份策略

```bash
# 全量备份
pg_dump -h localhost -U postgres -d ragagent \
  -F c -b -v -f ragagent_backup_$(date +%Y%m%d).dump

# 仅备份数据 (不含 schema)
pg_dump -h localhost -U postgres -d ragagent \
  -a -F c -f ragagent_data_$(date +%Y%m%d).dump

# 仅备份指定表
pg_dump -h localhost -U postgres -d ragagent \
  -t users -t agents -F c -f critical_tables_$(date +%Y%m%d).dump
```

### 13.2 恢复

```bash
# 恢复全量备份
pg_restore -h localhost -U postgres -d ragagent \
  -v ragagent_backup_20251208.dump

# 恢复指定表
pg_restore -h localhost -U postgres -d ragagent \
  -t users ragagent_backup_20251208.dump
```

---

## 14. 性能调优

### 14.1 连接池配置

```yaml
# HikariCP 配置
spring:
  datasource:
    hikari:
      maximum-pool-size: 20          # 最大连接数
      minimum-idle: 5                # 最小空闲连接
      connection-timeout: 30000      # 连接超时 (30秒)
      idle-timeout: 600000           # 空闲超时 (10分钟)
      max-lifetime: 1800000          # 最大生命周期 (30分钟)
```

### 14.2 PostgreSQL 配置

```conf
# postgresql.conf
shared_buffers = 4GB                 # 共享缓冲区
effective_cache_size = 12GB          # 有效缓存大小
maintenance_work_mem = 1GB           # 维护操作内存
work_mem = 16MB                      # 排序/哈希操作内存
max_connections = 200                # 最大连接数

# 向量检索优化
ivfflat.probes = 10                  # IVFFlat 探测数
```

---

## 15. 数据迁移

### 15.1 Flyway 迁移脚本

```sql
-- V1__init_schema.sql
CREATE TABLE users (...);
CREATE TABLE agents (...);

-- V2__add_multi_modal.sql
ALTER TABLE agents ADD COLUMN multi_modal BOOLEAN DEFAULT false;

-- V3__add_vector_index.sql
CREATE INDEX idx_embeddings_vector ON embeddings
USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);
```

### 15.2 数据迁移脚本

```sql
-- 迁移旧版用户数据
INSERT INTO users (id, username, email, password, created_at)
SELECT id, username, email, password_hash, created_at
FROM legacy_users
WHERE deleted = false;
```

---

## 附录

### A. 表统计信息

```sql
-- 查看表大小
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 查看表记录数
SELECT
  schemaname,
  tablename,
  n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

### B. 参考资源

- **PostgreSQL 文档**: https://www.postgresql.org/docs/
- **PGVector 文档**: https://github.com/pgvector/pgvector
- **HikariCP 文档**: https://github.com/brettwooldridge/HikariCP
