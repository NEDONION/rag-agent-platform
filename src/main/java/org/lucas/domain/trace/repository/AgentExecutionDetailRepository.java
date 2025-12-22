package org.lucas.domain.trace.repository;

import org.apache.ibatis.annotations.Mapper;
import org.lucas.domain.trace.model.AgentExecutionDetailEntity;
import org.lucas.infrastructure.repository.MyBatisPlusExtRepository;

/** Agent执行链路详细记录仓库接口 */
@Mapper
public interface AgentExecutionDetailRepository extends MyBatisPlusExtRepository<AgentExecutionDetailEntity> {
}