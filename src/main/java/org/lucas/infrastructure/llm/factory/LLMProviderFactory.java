package org.lucas.infrastructure.llm.factory;

import dev.langchain4j.model.anthropic.AnthropicChatModel;
import dev.langchain4j.model.anthropic.AnthropicStreamingChatModel;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.model.openai.OpenAiStreamingChatModel;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.lucas.infrastructure.llm.config.ProviderConfig;
import org.lucas.infrastructure.llm.protocol.enums.ProviderProtocol;

public class LLMProviderFactory {

    private static final Logger log = LoggerFactory.getLogger(LLMProviderFactory.class);

    /** 非流式调用超时。这类调用（意图识别、语义改写、查询扩展等）体量小、应当很快返回，
     * 超时必须短——它们是在 SSE 事件之间同步执行的，一旦挂起前端就只能干等。 */
    private static final Duration BLOCKING_TIMEOUT = timeoutFromEnv("LLM_REQUEST_TIMEOUT_SECONDS", 60);

    /** 流式对话超时。允许长一些，但绝不能是"实际上等于没有超时"。 */
    private static final Duration STREAMING_TIMEOUT = timeoutFromEnv("LLM_STREAM_TIMEOUT_SECONDS", 300);

    /** 从环境变量读取超时秒数，非法或缺省时回落到默认值。 */
    private static Duration timeoutFromEnv(String name, long defaultSeconds) {
        String raw = System.getenv(name);
        if (raw != null && !raw.isBlank()) {
            try {
                long seconds = Long.parseLong(raw.trim());
                if (seconds > 0) {
                    return Duration.ofSeconds(seconds);
                }
                log.warn("{} 必须为正数，收到 '{}'，回落到默认值 {}s", name, raw, defaultSeconds);
            } catch (NumberFormatException e) {
                log.warn("{} 不是合法的整数：'{}'，回落到默认值 {}s", name, raw, defaultSeconds);
            }
        }
        return Duration.ofSeconds(defaultSeconds);
    }

    /** 获取对应的服务商 不使用工厂模式，因为 OpenAiChatModel 没有无参构造器，并且其他类型的模型不能适配
     * @param protocol 协议
     * @param providerConfig 服务商信息 */
    public static ChatModel getLLMProvider(ProviderProtocol protocol, ProviderConfig providerConfig) {
        ChatModel model = null;
        if (protocol == ProviderProtocol.OPENAI) {
            OpenAiChatModel.OpenAiChatModelBuilder openAiChatModelBuilder = new OpenAiChatModel.OpenAiChatModelBuilder();
            openAiChatModelBuilder.apiKey(providerConfig.getApiKey());
            openAiChatModelBuilder.baseUrl(providerConfig.getBaseUrl());
            openAiChatModelBuilder.customHeaders(providerConfig.getCustomHeaders());
            openAiChatModelBuilder.modelName(providerConfig.getModel());
            openAiChatModelBuilder.timeout(BLOCKING_TIMEOUT);
            model = new OpenAiChatModel(openAiChatModelBuilder);
        } else if (protocol == ProviderProtocol.ANTHROPIC) {
            model = AnthropicChatModel.builder().apiKey(providerConfig.getApiKey()).baseUrl(providerConfig.getBaseUrl())
                    .modelName(providerConfig.getModel()).version("2023-06-01").timeout(BLOCKING_TIMEOUT).build();
        }
        return model;
    }

    public static StreamingChatModel getLLMProviderByStream(ProviderProtocol protocol, ProviderConfig providerConfig) {
        StreamingChatModel model = null;
        if (protocol == ProviderProtocol.OPENAI) {
            model = new OpenAiStreamingChatModel.OpenAiStreamingChatModelBuilder().apiKey(providerConfig.getApiKey())
                    .baseUrl(providerConfig.getBaseUrl()).customHeaders(providerConfig.getCustomHeaders())
                    .modelName(providerConfig.getModel()).timeout(STREAMING_TIMEOUT).build();
        } else if (protocol == ProviderProtocol.ANTHROPIC) {
            model = AnthropicStreamingChatModel.builder().apiKey(providerConfig.getApiKey())
                    .baseUrl(providerConfig.getBaseUrl()).version("2023-06-01").modelName(providerConfig.getModel())
                    .timeout(STREAMING_TIMEOUT).build();
        }

        return model;
    }
}
