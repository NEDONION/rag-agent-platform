package org.lucas.domain.trace.model;

/** 模型调用信息值对象 封装单次模型调用的详细信息 */
public class ModelCallInfo {

    /** 模型部署名称 */
    private final String modelEndpoint;

    /** 提供商名称 */
    private final String providerName;

    /** 输入Token数 */
    private final Integer inputTokens;

    /** 输出Token数 */
    private final Integer outputTokens;

    /** 调用耗时(毫秒) */
    private final Integer callTime;

    /** 是否成功 */
    private final Boolean success;

    /** 错误信息 */
    private final String errorMessage;

    /** 是否使用了降级 */
    private final Boolean fallbackUsed;

    /** 降级原因 */
    private final String fallbackReason;

    /** 原始模型部署名称 */
    private final String originalEndpoint;

    /** 原始服务商名称 */
    private final String originalProviderName;

    private ModelCallInfo(Builder builder) {
        this.modelEndpoint = builder.modelEndpoint;
        this.providerName = builder.providerName;
        this.inputTokens = builder.inputTokens;
        this.outputTokens = builder.outputTokens;
        this.callTime = builder.callTime;
        this.success = builder.success;
        this.errorMessage = builder.errorMessage;
        this.fallbackUsed = builder.fallbackUsed;
        this.fallbackReason = builder.fallbackReason;
        this.originalEndpoint = builder.originalEndpoint;
        this.originalProviderName = builder.originalProviderName;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String modelEndpoint;
        private String providerName;
        private Integer inputTokens;
        private Integer outputTokens;
        private Integer callTime;
        private Boolean success = true;
        private String errorMessage;
        private Boolean fallbackUsed = false;
        private String fallbackReason;
        private String originalEndpoint;
        private String originalProviderName;

        public Builder modelEndpoint(String modelEndpoint) {
            this.modelEndpoint = modelEndpoint;
            return this;
        }

        public Builder providerName(String providerName) {
            this.providerName = providerName;
            return this;
        }

        public Builder inputTokens(Integer inputTokens) {
            this.inputTokens = inputTokens;
            return this;
        }

        public Builder outputTokens(Integer outputTokens) {
            this.outputTokens = outputTokens;
            return this;
        }

        public Builder callTime(Integer callTime) {
            this.callTime = callTime;
            return this;
        }

        public Builder success(Boolean success) {
            this.success = success;
            return this;
        }

        public Builder errorMessage(String errorMessage) {
            this.errorMessage = errorMessage;
            return this;
        }

        public Builder fallbackUsed(Boolean fallbackUsed) {
            this.fallbackUsed = fallbackUsed;
            return this;
        }

        public Builder fallbackReason(String fallbackReason) {
            this.fallbackReason = fallbackReason;
            return this;
        }

        public Builder originalEndpoint(String originalEndpoint) {
            this.originalEndpoint = originalEndpoint;
            return this;
        }

        public Builder originalProviderName(String originalProviderName) {
            this.originalProviderName = originalProviderName;
            return this;
        }

        public ModelCallInfo build() {
            return new ModelCallInfo(this);
        }
    }

    // Getter方法
    public String getModelEndpoint() {
        return modelEndpoint;
    }

    public String getProviderName() {
        return providerName;
    }

    public Integer getInputTokens() {
        return inputTokens;
    }

    public Integer getOutputTokens() {
        return outputTokens;
    }

    public Integer getCallTime() {
        return callTime;
    }

    public Boolean getSuccess() {
        return success;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public Boolean getFallbackUsed() {
        return fallbackUsed;
    }

    public String getFallbackReason() {
        return fallbackReason;
    }

    public String getOriginalEndpoint() {
        return originalEndpoint;
    }

    public String getOriginalProviderName() {
        return originalProviderName;
    }

    /** 获取总Token数 */
    public Integer getTotalTokens() {
        if (inputTokens == null || outputTokens == null) {
            return null;
        }
        return inputTokens + outputTokens;
    }

    @Override
    public String toString() {
        return "ModelCallInfo{" + "modelEndpoint='" + modelEndpoint + '\'' + ", providerName='" + providerName + '\''
                + ", inputTokens=" + inputTokens + ", outputTokens=" + outputTokens + ", callTime=" + callTime
                + ", success=" + success + ", fallbackUsed=" + fallbackUsed + '}';
    }
}