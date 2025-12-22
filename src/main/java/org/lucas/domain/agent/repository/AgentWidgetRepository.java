package org.lucas.domain.agent.repository;

import org.apache.ibatis.annotations.Mapper;
import org.lucas.domain.agent.model.AgentWidgetEntity;
import org.lucas.infrastructure.repository.MyBatisPlusExtRepository;

/** Agent小组件配置仓储接口 */
@Mapper
public interface AgentWidgetRepository extends MyBatisPlusExtRepository<AgentWidgetEntity> {

}