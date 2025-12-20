-- ================================
-- RAG Agent Platform - 数据库初始化脚本
-- ================================
-- 此脚本在 PostgreSQL 容器首次启动时自动执行
-- ================================

-- 设置客户端编码
SET client_encoding = 'UTF8';

-- 创建 PGVector 扩展（用于向量存储）
CREATE EXTENSION IF NOT EXISTS vector;

-- 验证扩展安装
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) THEN
        RAISE EXCEPTION 'PGVector 扩展安装失败！';
    ELSE
        RAISE NOTICE 'PGVector 扩展已成功安装';
    END IF;
END $$;

-- 创建 UUID 扩展（如果需要）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 设置时区
SET timezone = 'Asia/Shanghai';

-- 授予数据库权限
GRANT ALL PRIVILEGES ON DATABASE agentx TO postgres;

-- 创建 Schema（如果需要特定 Schema）
-- CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION postgres;

-- ================================
-- 向量存储表（由应用自动创建，这里仅作示例）
-- ================================
-- CREATE TABLE IF NOT EXISTS public.vector_store (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     embedding vector(1024),
--     metadata JSONB,
--     content TEXT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- 创建向量索引（提高查询性能）
-- CREATE INDEX IF NOT EXISTS vector_store_embedding_idx
--     ON public.vector_store
--     USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);

-- ================================
-- 性能优化配置
-- ================================
-- 调整查询计划器成本常数
ALTER DATABASE agentx SET random_page_cost = 1.1;
ALTER DATABASE agentx SET effective_io_concurrency = 200;

-- ================================
-- 完成提示
-- ================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RAG Agent Platform 数据库初始化完成！';
    RAISE NOTICE '数据库: agentx';
    RAISE NOTICE 'PGVector 扩展: ✓';
    RAISE NOTICE 'UUID 扩展: ✓';
    RAISE NOTICE '时区: Asia/Shanghai';
    RAISE NOTICE '========================================';
END $$;
