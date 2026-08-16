package org.lucas.domain.conversation.constant;

/** 消息类型枚举 */
public enum MessageType {
    /** 普通文本消息 */
    TEXT,

    /** Agent 对话的思考过程（推理模型的 reasoning 内容）。
     *
     * <p>与 {@code RAG_THINKING_*} 区分：那一组只由知识库问答链路产出，
     * 描述的是检索/改写/意图识别等**平台自己的处理步骤**；
     * 这一组来自**模型本身的推理输出**，由 langchain4j 的 onPartialReasoning 回调提供。 */
    THINKING_START,
    THINKING_PROGRESS,
    THINKING_END,

    /** 工具调用消息 */
    TOOL_CALL,

    /** 任务执行消息 */
    TASK_EXEC,
    /** 任务状态进行中 */
    TASK_STATUS_TO_LOADING,

    /** 任务状态完成 */
    TASK_STATUS_TO_FINISH,

    /** 任务拆分结束消息 */
    TASK_SPLIT_FINISH,

    /** RAG检索开始 */
    RAG_RETRIEVAL_START,

    /** RAG检索进行中 */
    RAG_RETRIEVAL_PROGRESS,

    /** RAG检索结束 */
    RAG_RETRIEVAL_END,

    /** RAG思考开始 */
    RAG_THINKING_START,

    /** RAG思考进行中 */
    RAG_THINKING_PROGRESS,

    /** RAG思考结束 */
    RAG_THINKING_END,

    /** RAG回答开始 */
    RAG_ANSWER_START,

    /** RAG回答进行中 */
    RAG_ANSWER_PROGRESS,

    /** RAG回答结束 */
    RAG_ANSWER_END
}