package org.lucas.domain.agent.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.lucas.domain.agent.constant.WidgetType;
import org.lucas.infrastructure.converter.ListStringConverter;
import org.lucas.infrastructure.converter.WidgetTypeConverter;
import org.lucas.infrastructure.entity.BaseEntity;
import org.lucas.infrastructure.exception.BusinessException;

/** Agent小组件配置实体类，用于管理Agent的网站嵌入配置 */
@TableName(value = "agent_widgets", autoResultMap = true)
public class AgentWidgetEntity extends BaseEntity {

    /** 主键ID */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** Agent ID */
    @TableField("agent_id")
    private String agentId;

    /** 创建者用户ID */
    @TableField("user_id")
    private String userId;

    /** Widget访问的唯一ID */
    @TableField("public_id")
    private String publicId;

    /** Widget名称 */
    @TableField("name")
    private String name;

    /** Widget描述 */
    @TableField("description")
    private String description;

    /** 指定使用的模型ID */
    @TableField("model_id")
    private String modelId;

    /** 可选：指定服务商ID */
    @TableField("provider_id")
    private String providerId;

    /** 允许的域名列表 */
    @TableField(value = "allowed_domains", typeHandler = ListStringConverter.class)
    private List<String> allowedDomains;

    /** 每日调用限制（-1为无限制） */
    @TableField("daily_limit")
    private Integer dailyLimit;

    /** 是否启用 */
    @TableField("enabled")
    private Boolean enabled;

    /** Widget类型：AGENT/RAG */
    @TableField(value = "widget_type", typeHandler = WidgetTypeConverter.class)
    private WidgetType widgetType = WidgetType.AGENT;

    /** 知识库ID列表（RAG类型专用） */
    @TableField(value = "knowledge_base_ids", typeHandler = ListStringConverter.class)
    private List<String> knowledgeBaseIds;

    /** 无参构造函数 */
    public AgentWidgetEntity() {
        this.enabled = true;
        this.dailyLimit = -1;
    }

    /** 创建新的小组件配置 */
    public static AgentWidgetEntity createNew(String agentId, String userId, String name, String description,
            String modelId, String providerId, List<String> allowedDomains, Integer dailyLimit) {
        return createNew(agentId, userId, name, description, modelId, providerId, allowedDomains, dailyLimit,
                WidgetType.AGENT, null);
    }

    /** 创建新的小组件配置（支持Widget类型） */
    public static AgentWidgetEntity createNew(String agentId, String userId, String name, String description,
            String modelId, String providerId, List<String> allowedDomains, Integer dailyLimit, WidgetType widgetType,
            List<String> knowledgeBaseIds) {
        AgentWidgetEntity widget = new AgentWidgetEntity();
        widget.setAgentId(agentId);
        widget.setUserId(userId);
        widget.setPublicId(generateUniquePublicId());
        widget.setName(name);
        widget.setDescription(description);
        widget.setModelId(modelId);
        widget.setProviderId(providerId);
        widget.setAllowedDomains(allowedDomains);
        widget.setDailyLimit(dailyLimit != null ? dailyLimit : -1);
        widget.setWidgetType(widgetType != null ? widgetType : WidgetType.AGENT);
        widget.setKnowledgeBaseIds(knowledgeBaseIds);
        widget.setEnabled(true);
        widget.setCreatedAt(LocalDateTime.now());
        widget.setUpdatedAt(LocalDateTime.now());
        return widget;
    }

    /** 生成唯一的公开访问ID */
    private static String generateUniquePublicId() {
        return "widget_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    /** 检查是否启用 */
    public void checkEnabled() {
        if (!this.enabled) {
            throw new BusinessException("小组件配置已禁用");
        }
    }

    /** 检查域名是否允许访问 */
    public boolean isDomainAllowed(String domain) {
        if (allowedDomains == null || allowedDomains.isEmpty()) {
            return true; // 空白名单表示允许所有域名
        }

        // 检查精确匹配和通配符匹配
        for (String allowedDomain : allowedDomains) {
            if (domain.equals(allowedDomain)
                    || (allowedDomain.startsWith("*.") && domain.endsWith(allowedDomain.substring(1)))) {
                return true;
            }
        }
        return false;
    }

    /** 检查是否为RAG类型Widget */
    public boolean isRagWidget() {
        return this.widgetType != null && this.widgetType.isRag();
    }

    /** 检查是否为Agent类型Widget */
    public boolean isAgentWidget() {
        return this.widgetType == null || this.widgetType.isAgent();
    }

    /** 启用小组件配置 */
    public void enable() {
        this.enabled = true;
        this.updatedAt = LocalDateTime.now();
    }

    /** 禁用小组件配置 */
    public void disable() {
        this.enabled = false;
        this.updatedAt = LocalDateTime.now();
    }

    /** 更新小组件配置 */
    public void updateConfig(String name, String description, String modelId, String providerId,
            List<String> allowedDomains, Integer dailyLimit) {
        updateConfig(name, description, modelId, providerId, allowedDomains, dailyLimit, this.widgetType,
                this.knowledgeBaseIds);
    }

    /** 更新小组件配置（支持Widget类型） */
    public void updateConfig(String name, String description, String modelId, String providerId,
            List<String> allowedDomains, Integer dailyLimit, WidgetType widgetType, List<String> knowledgeBaseIds) {
        this.name = name;
        this.description = description;
        this.modelId = modelId;
        this.providerId = providerId;
        this.allowedDomains = allowedDomains;
        this.dailyLimit = dailyLimit != null ? dailyLimit : -1;
        this.widgetType = widgetType != null ? widgetType : WidgetType.AGENT;
        this.knowledgeBaseIds = knowledgeBaseIds;
        this.updatedAt = LocalDateTime.now();
    }

    /** 软删除 */
    public void delete() {
        this.deletedAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    // Getter和Setter方法
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getAgentId() {
        return agentId;
    }

    public void setAgentId(String agentId) {
        this.agentId = agentId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

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

    public String getModelId() {
        return modelId;
    }

    public void setModelId(String modelId) {
        this.modelId = modelId;
    }

    public String getProviderId() {
        return providerId;
    }

    public void setProviderId(String providerId) {
        this.providerId = providerId;
    }

    public List<String> getAllowedDomains() {
        return allowedDomains;
    }

    public void setAllowedDomains(List<String> allowedDomains) {
        this.allowedDomains = allowedDomains;
    }

    public Integer getDailyLimit() {
        return dailyLimit;
    }

    public void setDailyLimit(Integer dailyLimit) {
        this.dailyLimit = dailyLimit;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }

    public WidgetType getWidgetType() {
        return widgetType;
    }

    public void setWidgetType(WidgetType widgetType) {
        this.widgetType = widgetType;
    }

    public List<String> getKnowledgeBaseIds() {
        return knowledgeBaseIds;
    }

    public void setKnowledgeBaseIds(List<String> knowledgeBaseIds) {
        this.knowledgeBaseIds = knowledgeBaseIds;
    }
}