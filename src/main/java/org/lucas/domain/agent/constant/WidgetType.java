package org.lucas.domain.agent.constant;

import org.lucas.infrastructure.exception.BusinessException;

/** Widget类型枚举 */
public enum WidgetType {

    /** Agent类型Widget - 使用Agent工具流程 */
    AGENT,

    /** RAG类型Widget - 直接使用RAG对话流程 */
    RAG;

    /** 从字符串代码转换为枚举值
     * @param code 字符串代码
     * @return 对应的WidgetType枚举值 */
    public static WidgetType fromCode(String code) {
        for (WidgetType type : values()) {
            if (type.name().equals(code)) {
                return type;
            }
        }
        throw new BusinessException("未知的Widget类型码: " + code);
    }

    /** 检查是否为RAG类型
     * @return true if RAG type */
    public boolean isRag() {
        return this == RAG;
    }

    /** 检查是否为Agent类型
     * @return true if Agent type */
    public boolean isAgent() {
        return this == AGENT;
    }
}