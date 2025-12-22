package org.lucas.application.agent.service;

import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.lucas.application.agent.assembler.AgentWidgetAssembler;
import org.lucas.application.agent.dto.AgentWidgetDTO;
import org.lucas.application.llm.assembler.ModelAssembler;
import org.lucas.application.llm.assembler.ProviderAssembler;
import org.lucas.application.llm.dto.ModelDTO;
import org.lucas.application.llm.dto.ProviderDTO;
import org.lucas.domain.agent.model.AgentEntity;
import org.lucas.domain.agent.model.AgentWidgetEntity;
import org.lucas.domain.agent.repository.AgentRepository;
import org.lucas.domain.agent.service.AgentWidgetDomainService;
import org.lucas.domain.llm.model.ModelEntity;
import org.lucas.domain.llm.model.ProviderEntity;
import org.lucas.domain.llm.service.LLMDomainService;
import org.lucas.infrastructure.exception.BusinessException;
import org.lucas.interfaces.dto.agent.request.CreateWidgetRequest;
import org.lucas.interfaces.dto.agent.request.UpdateWidgetRequest;

/** Agent小组件配置应用服务 */
@Service
public class AgentWidgetAppService {

    private final AgentWidgetDomainService agentWidgetDomainService;
    private final AgentRepository agentRepository;
    private final LLMDomainService llmDomainService;
    private final AgentWidgetAssembler agentWidgetAssembler;

    public AgentWidgetAppService(AgentWidgetDomainService agentWidgetDomainService, AgentRepository agentRepository,
            LLMDomainService llmDomainService, AgentWidgetAssembler agentWidgetAssembler) {
        this.agentWidgetDomainService = agentWidgetDomainService;
        this.agentRepository = agentRepository;
        this.llmDomainService = llmDomainService;
        this.agentWidgetAssembler = agentWidgetAssembler;
    }

    /** 创建小组件配置
     *
     * @param agentId Agent ID
     * @param request 创建请求
     * @param userId 用户ID
     * @return 创建的小组件配置DTO */
    @Transactional
    public AgentWidgetDTO createWidget(String agentId, CreateWidgetRequest request, String userId) {
        // 1. 验证Agent权限
        validateAgentOwnership(agentId, userId);

        // 2. 检查是否可以创建更多小组件配置（可选限制）
        // if (!agentWidgetDomainService.canCreateMoreWidgets(userId, 10)) {
        // throw new BusinessException("已达到最大小组件配置数量限制");
        // }

        // 3. 创建小组件配置实体
        AgentWidgetEntity widget = AgentWidgetAssembler.toEntity(request, agentId, userId);

        // 4. 保存到数据库
        AgentWidgetEntity savedWidget = agentWidgetDomainService.createWidget(widget);

        // 5. 获取关联的模型和服务商信息
        ModelEntity model = llmDomainService.getModelById(widget.getModelId());
        ProviderEntity provider = llmDomainService.getProvider(model.getProviderId());

        // 6. 转换为DTO并返回
        return agentWidgetAssembler.toDTOWithEmbedCode(savedWidget, ModelAssembler.toDTO(model),
                ProviderAssembler.toDTO(provider));
    }

    /** 获取Agent的所有小组件配置
     *
     * @param agentId Agent ID
     * @param userId 用户ID
     * @return 小组件配置列表 */
    public List<AgentWidgetDTO> getWidgetsByAgent(String agentId, String userId) {
        // 1. 验证Agent权限
        validateAgentOwnership(agentId, userId);

        // 2. 获取小组件配置列表
        List<AgentWidgetEntity> widgets = agentWidgetDomainService.getWidgetsByAgent(agentId, userId);

        if (widgets.isEmpty()) {
            return List.of();
        }

        // 3. 批量获取模型和服务商信息
        List<ModelDTO> models = new ArrayList<>();
        List<ProviderDTO> providers = new ArrayList<>();

        for (AgentWidgetEntity widget : widgets) {
            // 查询模型信息
            ModelEntity model = llmDomainService.getModelById(widget.getModelId());
            ModelDTO modelDTO = model != null ? ModelAssembler.toDTO(model) : null;
            models.add(modelDTO);

            // 查询提供商信息
            ProviderEntity provider = null;
            if (model != null) {
                provider = llmDomainService.getProvider(model.getProviderId());
            }
            ProviderDTO providerDTO = provider != null ? ProviderAssembler.toDTO(provider) : null;
            providers.add(providerDTO);
        }

        // 4. 转换为DTO列表
        return AgentWidgetAssembler.toDTOsWithEmbedCode(widgets, models, providers,
                agentWidgetAssembler.frontendBaseUrl);
    }

    /** 获取用户的所有小组件配置
     *
     * @param userId 用户ID
     * @return 小组件配置列表 */
    public List<AgentWidgetDTO> getWidgetsByUser(String userId) {
        List<AgentWidgetEntity> widgets = agentWidgetDomainService.getWidgetsByUser(userId);

        if (widgets.isEmpty()) {
            return List.of();
        }

        List<ModelDTO> models = new ArrayList<>();
        List<ProviderDTO> providers = new ArrayList<>();

        for (AgentWidgetEntity widget : widgets) {
            // 查询模型信息
            ModelEntity model = llmDomainService.getModelById(widget.getModelId());
            ModelDTO modelDTO = model != null ? ModelAssembler.toDTO(model) : null;
            models.add(modelDTO);

            // 查询提供商信息
            ProviderEntity provider = null;
            if (model != null) {
                provider = llmDomainService.getProvider(model.getProviderId());
            }
            ProviderDTO providerDTO = provider != null ? ProviderAssembler.toDTO(provider) : null;
            providers.add(providerDTO);
        }

        return AgentWidgetAssembler.toDTOsWithEmbedCode(widgets, models, providers,
                agentWidgetAssembler.frontendBaseUrl);
    }

    /** 更新小组件配置
     *
     * @param widgetId 小组件配置ID
     * @param request 更新请求
     * @param userId 用户ID
     * @return 更新后的小组件配置DTO */
    @Transactional
    public AgentWidgetDTO updateWidget(String widgetId, UpdateWidgetRequest request, String userId) {
        AgentWidgetEntity widget = agentWidgetDomainService.getWidgetById(widgetId, userId);

        AgentWidgetAssembler.updateEntity(widget, request);

        AgentWidgetEntity updatedWidget = agentWidgetDomainService.updateWidget(widget, userId);

        ModelEntity model = llmDomainService.getModelById(widget.getModelId());
        ProviderEntity provider = llmDomainService.getProvider(model.getProviderId());

        return agentWidgetAssembler.toDTOWithEmbedCode(updatedWidget, ModelAssembler.toDTO(model),
                ProviderAssembler.toDTO(provider));
    }

    /** 切换小组件配置启用状态
     *
     * @param widgetId 小组件配置ID
     * @param userId 用户ID
     * @return 更新后的小组件配置DTO */
    @Transactional
    public AgentWidgetDTO toggleWidgetStatus(String widgetId, String userId) {
        AgentWidgetEntity widget = agentWidgetDomainService.toggleWidgetStatus(widgetId, userId);
        ModelEntity model = llmDomainService.getModelById(widget.getModelId());
        ProviderEntity provider = llmDomainService.getProvider(model.getProviderId());

        return agentWidgetAssembler.toDTOWithEmbedCode(widget, ModelAssembler.toDTO(model),
                ProviderAssembler.toDTO(provider));
    }

    /** 删除小组件配置
     *
     * @param widgetId 小组件配置ID
     * @param userId 用户ID */
    @Transactional
    public void deleteWidget(String widgetId, String userId) {
        agentWidgetDomainService.deleteWidget(widgetId, userId);
    }

    /** 获取小组件配置详情
     *
     * @param widgetId 小组件配置ID
     * @param userId 用户ID
     * @return 小组件配置DTO */
    public AgentWidgetDTO getWidgetDetail(String widgetId, String userId) {
        AgentWidgetEntity widget = agentWidgetDomainService.getWidgetById(widgetId, userId);

        ModelEntity model = llmDomainService.getModelById(widget.getModelId());
        ProviderEntity provider = llmDomainService.getProvider(model.getProviderId());

        return agentWidgetAssembler.toDTOWithEmbedCode(widget, ModelAssembler.toDTO(model),
                ProviderAssembler.toDTO(provider));
    }

    /** 根据公开ID获取小组件配置（用于公开访问）
     *
     * @param publicId 公开访问ID
     * @return 小组件配置实体 */
    public AgentWidgetEntity getWidgetForPublicAccess(String publicId) {
        return agentWidgetDomainService.getEnabledWidgetByPublicId(publicId);
    }

    /** 验证域名访问权限
     *
     * @param publicId 公开访问ID
     * @param domain 访问域名
     * @return 是否允许访问 */
    public boolean validateDomainAccess(String publicId, String domain) {
        return agentWidgetDomainService.validateDomainAccess(publicId, domain);
    }

    /** 获取完整的小组件信息（包含Agent配置信息，用于公开访问）
     *
     * @param publicId 公开访问ID
     * @return 包含Agent配置信息的WidgetInfo */
    public WidgetInfoForPublicAccess getWidgetInfoForPublicAccess(String publicId) {
        // 1. 获取小组件配置
        AgentWidgetEntity widget = agentWidgetDomainService.getEnabledWidgetByPublicId(publicId);

        // 2. 获取关联的Agent信息
        AgentEntity agent = agentRepository.selectById(widget.getAgentId());
        if (agent == null || agent.getDeletedAt() != null) {
            throw new BusinessException("关联的Agent不存在");
        }

        // 3. 构建完整的信息对象
        WidgetInfoForPublicAccess info = new WidgetInfoForPublicAccess();

        // Widget基本信息
        info.setPublicId(widget.getPublicId());
        info.setName(widget.getName());
        info.setDescription(widget.getDescription());
        info.setDailyLimit(widget.getDailyLimit());
        info.setEnabled(widget.getEnabled());
        // TODO: 实现每日调用次数统计，目前暂时设置为0
        info.setDailyCalls(0);

        // Agent配置信息（用于无会话聊天）
        info.setAgentName(agent.getName());
        info.setAgentAvatar(agent.getAvatar());
        info.setWelcomeMessage(agent.getWelcomeMessage());
        info.setSystemPrompt(agent.getSystemPrompt());

        // 工具和知识库ID（需要转换为List<String>）
        if (agent.getToolIds() != null) {
            info.setToolIds(agent.getToolIds());
        }
        if (agent.getKnowledgeBaseIds() != null) {
            info.setKnowledgeBaseIds(agent.getKnowledgeBaseIds());
        }

        return info;
    }

    /** 完整的小组件信息类（用于公开访问） */
    public static class WidgetInfoForPublicAccess {
        private String publicId;
        private String name;
        private String description;
        private Integer dailyLimit;
        private Integer dailyCalls;
        private Boolean enabled;

        // Agent相关信息（用于无会话聊天）
        private String agentName;
        private String agentAvatar;
        private String welcomeMessage;
        private String systemPrompt;
        private List<String> toolIds;
        private List<String> knowledgeBaseIds;

        // Getter和Setter方法
        public String getPublicId() {
            return publicId;
        }

        public void setPublicId(String publicId) {
            this.publicId = publicId;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public Integer getDailyLimit() {
            return dailyLimit;
        }

        public void setDailyLimit(Integer dailyLimit) {
            this.dailyLimit = dailyLimit;
        }

        public Integer getDailyCalls() {
            return dailyCalls;
        }

        public void setDailyCalls(Integer dailyCalls) {
            this.dailyCalls = dailyCalls;
        }

        public Boolean getEnabled() {
            return enabled;
        }

        public void setEnabled(Boolean enabled) {
            this.enabled = enabled;
        }

        public String getAgentName() {
            return agentName;
        }

        public void setAgentName(String agentName) {
            this.agentName = agentName;
        }

        public String getAgentAvatar() {
            return agentAvatar;
        }

        public void setAgentAvatar(String agentAvatar) {
            this.agentAvatar = agentAvatar;
        }

        public String getWelcomeMessage() {
            return welcomeMessage;
        }

        public void setWelcomeMessage(String welcomeMessage) {
            this.welcomeMessage = welcomeMessage;
        }

        public String getSystemPrompt() {
            return systemPrompt;
        }

        public void setSystemPrompt(String systemPrompt) {
            this.systemPrompt = systemPrompt;
        }

        public List<String> getToolIds() {
            return toolIds;
        }

        public void setToolIds(List<String> toolIds) {
            this.toolIds = toolIds;
        }

        public List<String> getKnowledgeBaseIds() {
            return knowledgeBaseIds;
        }

        public void setKnowledgeBaseIds(List<String> knowledgeBaseIds) {
            this.knowledgeBaseIds = knowledgeBaseIds;
        }
    }

    // 私有辅助方法

    /** 验证Agent所有权 */
    private void validateAgentOwnership(String agentId, String userId) {
        AgentEntity agent = agentRepository.selectById(agentId);
        if (agent == null || agent.getDeletedAt() != null) {
            throw new BusinessException("Agent不存在");
        }

        if (!agent.getUserId().equals(userId)) {
            throw new BusinessException("无权限操作此Agent");
        }
    }
}