# RAG Agent Platform - 技术文档索引

欢迎查阅 RAG Agent Platform 的技术文档。本文档索引将帮助您快速找到所需的技术资料。

---

## 📚 文档导航

### 核心文档

| 文档 | 描述 | 链接 |
|-----|------|------|
| **系统架构** | 整体架构设计、技术栈、DDD分层 | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **RAG 模块** | 文档处理、向量检索、版本化机制 | [RAG_MODULE.md](./RAG_MODULE.md) |
| **Agent 模块** | Agent 生命周期、工具集成、执行追踪 | [AGENT_MODULE.md](./AGENT_MODULE.md) |
| **数据库设计** | 表结构设计、ER 图、索引优化 | [DATABASE.md](./DATABASE.md) |
| **API 接口** | RESTful API、WebSocket、SSE | [API.md](./API.md) |
| **部署指南** | 环境搭建、Docker 部署、生产配置 | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| **开发指南** | 本地开发、代码规范、测试 | [DEVELOPMENT.md](./DEVELOPMENT.md) |

### 专题文档

| 文档 | 描述 | 链接 |
|-----|------|------|
| **LLM 模块** | 模型管理、高可用、Token 统计 | [LLM_MODULE.md](./LLM_MODULE.md) |
| **MCP 工具模块** | 工具导入、容器化、调用机制 | [MCP_MODULE.md](./MCP_MODULE.md) |
| **对话管理** | 会话管理、上下文窗口、Token 管控 | [CONVERSATION_MODULE.md](./CONVERSATION_MODULE.md) |
| **性能优化** | 数据库优化、缓存策略、并发处理 | [PERFORMANCE.md](./PERFORMANCE.md) |
| **安全最佳实践** | 认证授权、数据加密、多租户隔离 | [SECURITY.md](./SECURITY.md) |

---

## 🚀 快速开始

### 我是新手，想快速了解系统

1. **阅读系统架构** → [ARCHITECTURE.md](./ARCHITECTURE.md)
   - 了解整体架构设计
   - 熟悉技术栈和分层结构

2. **查看部署指南** → [DEPLOYMENT.md](./DEPLOYMENT.md)
   - 快速搭建本地开发环境
   - 理解系统依赖和配置

3. **浏览 API 文档** → [API.md](./API.md)
   - 了解核心 API 接口
   - 尝试调用示例

### 我想深入了解某个模块

- **RAG 检索系统**: [RAG_MODULE.md](./RAG_MODULE.md)
- **Agent 智能体**: [AGENT_MODULE.md](./AGENT_MODULE.md)
- **LLM 模型管理**: [LLM_MODULE.md](./LLM_MODULE.md)
- **MCP 工具集成**: [MCP_MODULE.md](./MCP_MODULE.md)

### 我想进行二次开发

1. **开发指南** → [DEVELOPMENT.md](./DEVELOPMENT.md)
   - 本地开发环境搭建
   - 代码规范和提交规范

2. **数据库设计** → [DATABASE.md](./DATABASE.md)
   - 理解表结构设计
   - 学习数据模型

3. **API 接口** → [API.md](./API.md)
   - 了解接口设计规范
   - 扩展新的 API

---

## 📖 文档说明

### 文档结构

每个文档通常包含以下章节：

1. **概述**: 模块功能简介
2. **核心功能**: 详细功能列表
3. **技术实现**: 关键代码和设计模式
4. **数据库设计**: 相关表结构
5. **API 接口**: 对外接口
6. **配置说明**: 相关配置项
7. **最佳实践**: 使用建议
8. **故障排查**: 常见问题解决

### 阅读建议

- **初学者**: 按照"快速开始"的顺序阅读
- **开发者**: 重点阅读模块文档和 API 文档
- **运维人员**: 重点阅读部署指南和性能优化
- **架构师**: 重点阅读系统架构和数据库设计

---

## 🔗 相关资源

### 官方资源

- **GitHub 仓库**: [https://github.com/your-repo/rag-agent-platform](https://github.com/your-repo/rag-agent-platform)
- **在线演示**: [https://demo.agentx.ai](https://demo.agentx.ai)
- **API 文档**: [https://api.agentx.ai/docs](https://api.agentx.ai/docs)

### 技术栈文档

- **Spring Boot**: [https://spring.io/projects/spring-boot](https://spring.io/projects/spring-boot)
- **Next.js**: [https://nextjs.org/docs](https://nextjs.org/docs)
- **LangChain4j**: [https://docs.langchain4j.dev](https://docs.langchain4j.dev)
- **PGVector**: [https://github.com/pgvector/pgvector](https://github.com/pgvector/pgvector)
- **RabbitMQ**: [https://www.rabbitmq.com/documentation.html](https://www.rabbitmq.com/documentation.html)

### 学习资源

- **DDD 领域驱动设计**: [《领域驱动设计》- Eric Evans](https://www.domainlanguage.com/ddd/)
- **RAG 技术**: [LangChain RAG Tutorial](https://python.langchain.com/docs/tutorials/rag/)
- **向量数据库**: [Pinecone Learning Center](https://www.pinecone.io/learn/)