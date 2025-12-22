package org.lucas.domain.agent.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import java.util.List;
import org.springframework.stereotype.Service;
import org.lucas.domain.agent.model.AgentWidgetEntity;
import org.lucas.domain.agent.repository.AgentWidgetRepository;
import org.lucas.infrastructure.exception.BusinessException;

/** Agent小组件配置领域服务 */
@Service
public class AgentWidgetDomainService {

    private final AgentWidgetRepository agentWidgetRepository;

    public AgentWidgetDomainService(AgentWidgetRepository agentWidgetRepository) {
        this.agentWidgetRepository = agentWidgetRepository;
    }

    /** 创建小组件配置
     *
     * @param widget 小组件配置实体
     * @return 创建的小组件配置 */
    public AgentWidgetEntity createWidget(AgentWidgetEntity widget) {

        LambdaQueryWrapper<AgentWidgetEntity> queryWrapper = Wrappers.<AgentWidgetEntity>lambdaQuery()
                .eq(AgentWidgetEntity::getPublicId, widget.getPublicId());
        boolean exists = agentWidgetRepository.exists(queryWrapper);
        // 检查公开ID是否唯一
        while (exists) {
            widget.setPublicId(generateNewPublicId());
        }

        agentWidgetRepository.insert(widget);
        return widget;
    }

    /** 根据ID获取小组件配置
     *
     * @param widgetId 小组件配置ID
     * @param userId 用户ID（权限检查）
     * @return 小组件配置实体 */
    public AgentWidgetEntity getWidgetById(String widgetId, String userId) {
        AgentWidgetEntity widget = agentWidgetRepository.selectById(widgetId);
        if (widget == null || widget.getDeletedAt() != null) {
            throw new BusinessException("小组件配置不存在");
        }

        if (!widget.getUserId().equals(userId)) {
            throw new BusinessException("无权限访问此小组件配置");
        }

        return widget;
    }

    /** 根据公开ID获取启用的小组件配置
     *
     * @param publicId 公开访问ID
     * @return 启用的小组件配置实体 */
    public AgentWidgetEntity getEnabledWidgetByPublicId(String publicId) {
        LambdaQueryWrapper<AgentWidgetEntity> queryWrapper = Wrappers.<AgentWidgetEntity>lambdaQuery()
                .eq(AgentWidgetEntity::getPublicId, publicId).eq(AgentWidgetEntity::getEnabled, true);
        AgentWidgetEntity widget = agentWidgetRepository.selectOne(queryWrapper);
        if (widget == null) {
            throw new BusinessException("小组件配置不存在或已禁用");
        }
        return widget;
    }

    /** 获取Agent的所有小组件配置
     *
     * @param agentId Agent ID
     * @param userId 用户ID
     * @return 小组件配置列表 */
    public List<AgentWidgetEntity> getWidgetsByAgent(String agentId, String userId) {
        LambdaQueryWrapper<AgentWidgetEntity> queryWrapper = Wrappers.<AgentWidgetEntity>lambdaQuery()
                .eq(AgentWidgetEntity::getAgentId, agentId).eq(AgentWidgetEntity::getUserId, userId);
        return agentWidgetRepository.selectList(queryWrapper);
    }

    /** 获取用户的所有小组件配置
     *
     * @param userId 用户ID
     * @return 小组件配置列表 */
    public List<AgentWidgetEntity> getWidgetsByUser(String userId) {
        LambdaQueryWrapper<AgentWidgetEntity> queryWrapper = Wrappers.<AgentWidgetEntity>lambdaQuery()
                .eq(AgentWidgetEntity::getUserId, userId);
        return agentWidgetRepository.selectList(queryWrapper);
    }

    /** 更新小组件配置
     *
     * @param widget 小组件配置实体
     * @param userId 用户ID（权限检查）
     * @return 更新后的小组件配置 */
    public AgentWidgetEntity updateWidget(AgentWidgetEntity widget, String userId) {
        // 权限检查
        if (!widget.getUserId().equals(userId)) {
            throw new BusinessException("无权限修改此小组件配置");
        }

        LambdaUpdateWrapper<AgentWidgetEntity> updateWrapper = Wrappers.<AgentWidgetEntity>lambdaUpdate()
                .eq(AgentWidgetEntity::getId, widget.getId()).eq(AgentWidgetEntity::getUserId, userId);

        agentWidgetRepository.checkedUpdate(widget, updateWrapper);
        return widget;
    }

    public void deleteWidgetById(String widgetId, String userId) {

        agentWidgetRepository.delete(Wrappers.<AgentWidgetEntity>lambdaUpdate().eq(AgentWidgetEntity::getId, widgetId)
                .eq(AgentWidgetEntity::getUserId, userId));
    }

    /** 切换小组件配置启用状态
     *
     * @param widgetId 小组件配置ID
     * @param userId 用户ID
     * @return 更新后的小组件配置 */
    public AgentWidgetEntity toggleWidgetStatus(String widgetId, String userId) {
        AgentWidgetEntity widget = getWidgetById(widgetId, userId);

        if (widget.getEnabled()) {
            widget.disable();
        } else {
            widget.enable();
        }

        return updateWidget(widget, userId);
    }

    /** 删除小组件配置（软删除）
     *
     * @param widgetId 小组件配置ID
     * @param userId 用户ID */
    public void deleteWidget(String widgetId, String userId) {
        LambdaUpdateWrapper<AgentWidgetEntity> updateWrapper = Wrappers.<AgentWidgetEntity>lambdaUpdate()
                .eq(AgentWidgetEntity::getId, widgetId).eq(AgentWidgetEntity::getUserId, userId);

        agentWidgetRepository.delete(updateWrapper);
    }

    /** 验证域名访问权限
     *
     * @param publicId 公开访问ID
     * @param domain 访问域名
     * @return 是否允许访问 */
    public boolean validateDomainAccess(String publicId, String domain) {
        try {
            AgentWidgetEntity widget = getEnabledWidgetByPublicId(publicId);
            return widget.isDomainAllowed(domain);
        } catch (BusinessException e) {
            return false;
        }
    }

    /** 统计用户的小组件配置数量
     *
     * @param userId 用户ID
     * @return 配置数量 */
    public long countWidgetsByUser(String userId) {
        LambdaQueryWrapper<AgentWidgetEntity> queryWrapper = Wrappers.<AgentWidgetEntity>lambdaQuery()
                .eq(AgentWidgetEntity::getUserId, userId);
        return agentWidgetRepository.selectCount(queryWrapper);
    }

    /** 统计Agent的小组件配置数量
     *
     * @param agentId Agent ID
     * @param userId 用户ID
     * @return 配置数量 */
    public long countWidgetsByAgent(String agentId, String userId) {
        LambdaQueryWrapper<AgentWidgetEntity> queryWrapper = Wrappers.<AgentWidgetEntity>lambdaQuery()
                .eq(AgentWidgetEntity::getAgentId, agentId).eq(AgentWidgetEntity::getUserId, userId);
        return agentWidgetRepository.selectCount(queryWrapper);
    }

    /** 检查用户是否可以创建更多小组件配置
     *
     * @param userId 用户ID
     * @param maxWidgets 最大小组件配置数量（-1表示无限制）
     * @return 是否可以创建 */
    public boolean canCreateMoreWidgets(String userId, int maxWidgets) {
        if (maxWidgets == -1) {
            return true; // 无限制
        }

        long currentCount = countWidgetsByUser(userId);
        return currentCount < maxWidgets;
    }

    /** 生成新的公开ID */
    private String generateNewPublicId() {
        return "widget_" + java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    /** 批量获取小组件配置 */
    public List<AgentWidgetEntity> getWidgetsByIds(List<String> widgetIds, String userId) {
        if (widgetIds == null || widgetIds.isEmpty()) {
            return List.of();
        }

        LambdaQueryWrapper<AgentWidgetEntity> queryWrapper = Wrappers.<AgentWidgetEntity>lambdaQuery()
                .in(AgentWidgetEntity::getId, widgetIds).eq(AgentWidgetEntity::getUserId, userId)
                .isNull(AgentWidgetEntity::getDeletedAt).orderByDesc(AgentWidgetEntity::getCreatedAt);

        return agentWidgetRepository.selectList(queryWrapper);
    }
}