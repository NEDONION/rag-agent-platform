package org.lucas.domain.trace.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import org.lucas.infrastructure.entity.BaseEntity;

/** Agent执行链路详细记录实体 记录Agent执行过程中每个步骤的详细信息 */
@TableName("agent_execution_details")
public class AgentExecutionDetailEntity extends BaseEntity {

    /** 主键ID */
    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /** 关联汇总表的会话ID */
    @TableField("session_id")
    private String sessionId;

    /** 统一的消息内容 */
    @TableField("message_content")
    private String messageContent;

    /** 消息类型：USER_MESSAGE, AI_RESPONSE, TOOL_CALL */
    @TableField("message_type")
    private String messageType;

    /** 此次使用的模型部署名称 */
    @TableField("model_endpoint")
    private String modelEndpoint;

    /** 提供商名称 */
    @TableField("provider_name")
    private String providerName;

    /** 消息Token数 */
    @TableField("message_tokens")
    private Integer messageTokens;

    /** 模型调用耗时(毫秒) */
    @TableField("model_call_time")
    private Integer modelCallTime;

    /** 工具名称 */
    @TableField("tool_name")
    private String toolName;

    /** 工具调用入参(JSON格式) */
    @TableField("tool_request_args")
    private String toolRequestArgs;

    /** 工具调用出参(JSON格式) */
    @TableField("tool_response_data")
    private String toolResponseData;

    /** 工具执行耗时(毫秒) */
    @TableField("tool_execution_time")
    private Integer toolExecutionTime;

    /** 工具执行是否成功 */
    @TableField("tool_success")
    private Boolean toolSuccess;

    /** 是否触发了平替/降级 */
    @TableField("is_fallback_used")
    private Boolean isFallbackUsed;

    /** 降级原因 */
    @TableField("fallback_reason")
    private String fallbackReason;

    /** 降级前的模型部署名称 */
    @TableField("fallback_from_endpoint")
    private String fallbackFromEndpoint;

    /** 降级后的模型部署名称 */
    @TableField("fallback_to_endpoint")
    private String fallbackToEndpoint;

    /** 降级前的服务商名称 */
    @TableField("fallback_from_provider")
    private String fallbackFromProvider;

    /** 降级后的服务商名称 */
    @TableField("fallback_to_provider")
    private String fallbackToProvider;

    /** 步骤执行是否成功 */
    @TableField("step_success")
    private Boolean stepSuccess;

    /** 步骤错误信息 */
    @TableField("step_error_message")
    private String stepErrorMessage;

    public AgentExecutionDetailEntity() {
        this.isFallbackUsed = false;
        this.stepSuccess = true;
    }

    /** 创建用户消息步骤 */
    public static AgentExecutionDetailEntity createUserMessageStep(String sessionId, Integer sequenceNo,
            String userMessage, String messageType) {
        AgentExecutionDetailEntity entity = new AgentExecutionDetailEntity();
        entity.setSessionId(sessionId);
        entity.setMessageContent(userMessage);
        entity.setMessageType("USER_MESSAGE");
        return entity;
    }

    /** 创建用户消息步骤（带时间戳） */
    public static AgentExecutionDetailEntity createUserMessageStep(String sessionId, Integer sequenceNo,
            String userMessage, String messageType, LocalDateTime eventTime) {
        AgentExecutionDetailEntity entity = new AgentExecutionDetailEntity();
        entity.setSessionId(sessionId);
        entity.setMessageContent(userMessage);
        entity.setMessageType("USER_MESSAGE");
        entity.setCreatedAt(eventTime); // 手动设置事件发生时间
        return entity;
    }

    /** 创建带Token信息的用户消息步骤 */
    public static AgentExecutionDetailEntity createUserMessageStepWithTokens(String sessionId, Integer sequenceNo,
            String userMessage, String messageType, Integer messageTokens) {
        AgentExecutionDetailEntity entity = new AgentExecutionDetailEntity();
        entity.setSessionId(sessionId);
        entity.setMessageContent(userMessage);
        entity.setMessageType("USER_MESSAGE");
        entity.setMessageTokens(messageTokens);
        return entity;
    }

    /** 创建带Token信息的用户消息步骤（带时间戳） */
    public static AgentExecutionDetailEntity createUserMessageStepWithTokens(String sessionId, Integer sequenceNo,
            String userMessage, String messageType, Integer messageTokens, LocalDateTime eventTime) {
        AgentExecutionDetailEntity entity = new AgentExecutionDetailEntity();
        entity.setSessionId(sessionId);
        entity.setMessageContent(userMessage);
        entity.setMessageType("USER_MESSAGE");
        entity.setMessageTokens(messageTokens);
        entity.setCreatedAt(eventTime); // 手动设置事件发生时间
        return entity;
    }

    /** 创建AI响应步骤 */
    public static AgentExecutionDetailEntity createAiResponseStep(String sessionId, Integer sequenceNo,
            String aiResponse, String modelEndpoint, String providerName, Integer messageTokens,
            Integer modelCallTime) {
        AgentExecutionDetailEntity entity = new AgentExecutionDetailEntity();
        entity.setSessionId(sessionId);
        entity.setMessageContent(aiResponse);
        entity.setMessageType("AI_RESPONSE");
        entity.setModelEndpoint(modelEndpoint);
        entity.setProviderName(providerName);
        entity.setMessageTokens(messageTokens);
        entity.setModelCallTime(modelCallTime);
        return entity;
    }

    /** 创建AI响应步骤（带时间戳） */
    public static AgentExecutionDetailEntity createAiResponseStep(String sessionId, Integer sequenceNo,
            String aiResponse, String modelEndpoint, String providerName, Integer messageTokens, Integer modelCallTime,
            LocalDateTime eventTime) {
        AgentExecutionDetailEntity entity = new AgentExecutionDetailEntity();
        entity.setSessionId(sessionId);
        entity.setMessageContent(aiResponse);
        entity.setMessageType("AI_RESPONSE");
        entity.setModelEndpoint(modelEndpoint);
        entity.setProviderName(providerName);
        entity.setMessageTokens(messageTokens);
        entity.setModelCallTime(modelCallTime);
        entity.setCreatedAt(eventTime); // 手动设置事件发生时间
        return entity;
    }

    /** 创建工具调用步骤 */
    public static AgentExecutionDetailEntity createToolCallStep(String sessionId, Integer sequenceNo, String toolName,
            String requestArgs, String responseData, Integer executionTime, Boolean success) {
        AgentExecutionDetailEntity entity = new AgentExecutionDetailEntity();
        entity.setSessionId(sessionId);
        entity.setMessageContent("执行工具：" + toolName);
        entity.setMessageType("TOOL_CALL");
        entity.setToolName(toolName);
        entity.setToolRequestArgs(requestArgs);
        entity.setToolResponseData(responseData);
        entity.setToolExecutionTime(executionTime);
        entity.setToolSuccess(success);
        entity.setStepSuccess(success);
        return entity;
    }

    /** 创建工具调用步骤（带时间戳） */
    public static AgentExecutionDetailEntity createToolCallStep(String sessionId, Integer sequenceNo, String toolName,
            String requestArgs, String responseData, Integer executionTime, Boolean success, LocalDateTime eventTime) {
        AgentExecutionDetailEntity entity = new AgentExecutionDetailEntity();
        entity.setSessionId(sessionId);
        entity.setMessageContent("执行工具：" + toolName);
        entity.setMessageType("TOOL_CALL");
        entity.setToolName(toolName);
        entity.setToolRequestArgs(requestArgs);
        entity.setToolResponseData(responseData);
        entity.setToolExecutionTime(executionTime);
        entity.setToolSuccess(success);
        entity.setStepSuccess(success);
        entity.setCreatedAt(eventTime); // 手动设置事件发生时间
        return entity;
    }

    /** 设置模型降级信息 */
    public void setFallbackInfo(String reason, String fromEndpoint, String toEndpoint, String fromProvider,
            String toProvider) {
        this.isFallbackUsed = true;
        this.fallbackReason = reason;
        this.fallbackFromEndpoint = fromEndpoint;
        this.fallbackToEndpoint = toEndpoint;
        this.fallbackFromProvider = fromProvider;
        this.fallbackToProvider = toProvider;
    }

    /** 标记步骤失败 */
    public void markStepFailed(String errorMessage) {
        this.stepSuccess = false;
        this.stepErrorMessage = errorMessage;
    }

    /** 创建异常消息步骤 */
    public static AgentExecutionDetailEntity createErrorMessageStep(String sessionId, String errorMessage,
            LocalDateTime eventTime) {
        AgentExecutionDetailEntity entity = new AgentExecutionDetailEntity();
        entity.setSessionId(sessionId);
        entity.setMessageContent(errorMessage != null ? errorMessage : "未知错误");
        entity.setMessageType("ERROR_MESSAGE");
        entity.setStepSuccess(false);
        entity.setStepErrorMessage(errorMessage);
        entity.setCreatedAt(eventTime); // 设置异常发生时间
        return entity;
    }

    // Getter和Setter方法
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getMessageContent() {
        return messageContent;
    }

    public void setMessageContent(String messageContent) {
        this.messageContent = messageContent;
    }

    public String getMessageType() {
        return messageType;
    }

    public void setMessageType(String messageType) {
        this.messageType = messageType;
    }

    public String getModelEndpoint() {
        return modelEndpoint;
    }

    public void setModelEndpoint(String modelEndpoint) {
        this.modelEndpoint = modelEndpoint;
    }

    public String getProviderName() {
        return providerName;
    }

    public void setProviderName(String providerName) {
        this.providerName = providerName;
    }

    public Integer getMessageTokens() {
        return messageTokens;
    }

    public void setMessageTokens(Integer messageTokens) {
        this.messageTokens = messageTokens;
    }

    public Integer getModelCallTime() {
        return modelCallTime;
    }

    public void setModelCallTime(Integer modelCallTime) {
        this.modelCallTime = modelCallTime;
    }

    public String getToolName() {
        return toolName;
    }

    public void setToolName(String toolName) {
        this.toolName = toolName;
    }

    public String getToolRequestArgs() {
        return toolRequestArgs;
    }

    public void setToolRequestArgs(String toolRequestArgs) {
        this.toolRequestArgs = toolRequestArgs;
    }

    public String getToolResponseData() {
        return toolResponseData;
    }

    public void setToolResponseData(String toolResponseData) {
        this.toolResponseData = toolResponseData;
    }

    public Integer getToolExecutionTime() {
        return toolExecutionTime;
    }

    public void setToolExecutionTime(Integer toolExecutionTime) {
        this.toolExecutionTime = toolExecutionTime;
    }

    public Boolean getToolSuccess() {
        return toolSuccess;
    }

    public void setToolSuccess(Boolean toolSuccess) {
        this.toolSuccess = toolSuccess;
    }

    public Boolean getIsFallbackUsed() {
        return isFallbackUsed;
    }

    public void setIsFallbackUsed(Boolean isFallbackUsed) {
        this.isFallbackUsed = isFallbackUsed;
    }

    public String getFallbackReason() {
        return fallbackReason;
    }

    public void setFallbackReason(String fallbackReason) {
        this.fallbackReason = fallbackReason;
    }

    public String getFallbackFromEndpoint() {
        return fallbackFromEndpoint;
    }

    public void setFallbackFromEndpoint(String fallbackFromEndpoint) {
        this.fallbackFromEndpoint = fallbackFromEndpoint;
    }

    public String getFallbackToEndpoint() {
        return fallbackToEndpoint;
    }

    public void setFallbackToEndpoint(String fallbackToEndpoint) {
        this.fallbackToEndpoint = fallbackToEndpoint;
    }

    public String getFallbackFromProvider() {
        return fallbackFromProvider;
    }

    public void setFallbackFromProvider(String fallbackFromProvider) {
        this.fallbackFromProvider = fallbackFromProvider;
    }

    public String getFallbackToProvider() {
        return fallbackToProvider;
    }

    public void setFallbackToProvider(String fallbackToProvider) {
        this.fallbackToProvider = fallbackToProvider;
    }

    public Boolean getStepSuccess() {
        return stepSuccess;
    }

    public void setStepSuccess(Boolean stepSuccess) {
        this.stepSuccess = stepSuccess;
    }

    public String getStepErrorMessage() {
        return stepErrorMessage;
    }

    public void setStepErrorMessage(String stepErrorMessage) {
        this.stepErrorMessage = stepErrorMessage;
    }

}