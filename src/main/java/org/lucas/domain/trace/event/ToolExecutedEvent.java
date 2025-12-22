package org.lucas.domain.trace.event;

import java.time.LocalDateTime;
import org.springframework.context.ApplicationEvent;
import org.lucas.domain.trace.model.ToolCallInfo;
import org.lucas.domain.trace.model.TraceContext;

/** 工具执行事件 */
public class ToolExecutedEvent extends ApplicationEvent {

    private final TraceContext traceContext;
    private final ToolCallInfo toolCallInfo;
    private final LocalDateTime toolExecutionStartTime;

    public ToolExecutedEvent(Object source, TraceContext traceContext, ToolCallInfo toolCallInfo) {
        super(source);
        this.traceContext = traceContext;
        this.toolCallInfo = toolCallInfo;
        this.toolExecutionStartTime = LocalDateTime.now(); // 默认使用当前时间
    }

    public ToolExecutedEvent(Object source, TraceContext traceContext, ToolCallInfo toolCallInfo,
            LocalDateTime toolExecutionStartTime) {
        super(source);
        this.traceContext = traceContext;
        this.toolCallInfo = toolCallInfo;
        this.toolExecutionStartTime = toolExecutionStartTime;
    }

    public TraceContext getTraceContext() {
        return traceContext;
    }

    public ToolCallInfo getToolCallInfo() {
        return toolCallInfo;
    }

    public LocalDateTime getToolExecutionStartTime() {
        return toolExecutionStartTime;
    }
}