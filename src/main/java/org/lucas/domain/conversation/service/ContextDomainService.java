package org.lucas.domain.conversation.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.lucas.domain.conversation.model.ContextEntity;
import org.lucas.domain.conversation.repository.ContextRepository;
import org.lucas.infrastructure.exception.BusinessException;

@Service
public class ContextDomainService {

    private static final Logger logger = LoggerFactory.getLogger(ContextDomainService.class);

    private final ContextRepository contextRepository;

    public ContextDomainService(ContextRepository contextRepository) {
        this.contextRepository = contextRepository;
    }

    // 获取历史消息id
    public ContextEntity getBySessionId(String sessionId) {
        LambdaQueryWrapper<ContextEntity> wrapper = Wrappers.<ContextEntity>lambdaQuery()
                .eq(ContextEntity::getSessionId, sessionId).select();
        ContextEntity contextEntity = contextRepository.selectOne(wrapper);
        if (contextEntity == null) {
            throw new BusinessException("消息上下文不存在");
        }
        return contextEntity;
    }

    public ContextEntity findBySessionId(String sessionId) {
        LambdaQueryWrapper<ContextEntity> wrapper = Wrappers.<ContextEntity>lambdaQuery()
                .eq(ContextEntity::getSessionId, sessionId);
        return contextRepository.selectOne(wrapper);
    }

    public ContextEntity insertOrUpdate(ContextEntity contextEntity) {
        try {
            contextRepository.insertOrUpdate(contextEntity);
        } catch (Exception e) {
            // FIXME 这里吞掉了写库失败：调用方会拿到一个「看起来成功」的实体，
            // 而上下文实际未持久化，表现为对话历史莫名丢失。改成抛出会影响现有调用方，
            // 需要先确认各调用点的处理方式，暂时至少保证异常可见。
            logger.error("保存会话上下文失败，sessionId={}，上下文未持久化", contextEntity.getSessionId(), e);
        }
        return contextEntity;
    }
}
