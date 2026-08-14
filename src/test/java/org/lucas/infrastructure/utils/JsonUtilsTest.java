package org.lucas.infrastructure.utils;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.lucas.domain.llm.model.config.ProviderConfig;

/** {@link JsonUtils} 的行为，重点是**不得把序列化内容打印到 stdout/stderr**。
 *
 * <p>背景：这里曾有一组 `System.out.println("JsonUtils Debug - ...")` 调试语句，无条件执行。
 * 由于 {@code ProviderConfigConverter} 用本类序列化含用户 API Key 的 {@code ProviderConfig}，
 * 每次保存服务商配置都会把**明文密钥**打进 stdout，进而落到容器日志和 `logs/agent-x.log`——
 * 使落库的 AES/GCM 加密完全失去意义。
 *
 * <p>这类回归很隐蔽：功能完全正常，测试也照过，只有日志里多了几行。所以这里直接断言
 * 「输出流必须干净」，而不是断言某几行不出现。 */
class JsonUtilsTest {

    private static final String SECRET = "sk-SECRET-USER-PROVIDER-KEY-9f3a";

    private final PrintStream originalOut = System.out;
    private final PrintStream originalErr = System.err;

    @AfterEach
    void restoreStreams() {
        System.setOut(originalOut);
        System.setErr(originalErr);
    }

    /** 执行 action，返回它写进 stdout + stderr 的全部内容 */
    private String captureOutput(Supplier<?> action) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteArrayOutputStream err = new ByteArrayOutputStream();
        System.setOut(new PrintStream(out, true, StandardCharsets.UTF_8));
        System.setErr(new PrintStream(err, true, StandardCharsets.UTF_8));
        try {
            action.get();
        } finally {
            System.setOut(originalOut);
            System.setErr(originalErr);
        }
        return out.toString(StandardCharsets.UTF_8) + err.toString(StandardCharsets.UTF_8);
    }

    private static ProviderConfig providerConfigWithSecret() {
        ProviderConfig config = new ProviderConfig();
        config.setApiKey(SECRET);
        config.setBaseUrl("https://api.example.com");
        return config;
    }

    @Nested
    @DisplayName("不得泄露到标准输出")
    class NoStdoutLeak {

        @Test
        @DisplayName("序列化服务商配置时不打印明文密钥")
        void toJsonStringDoesNotPrintSecret() {
            String output = captureOutput(() -> JsonUtils.toJsonString(providerConfigWithSecret()));

            assertThat(output).doesNotContain(SECRET);
            assertThat(output).isEmpty();
        }

        @Test
        @DisplayName("parseMap 不打印入参与结果")
        void parseMapDoesNotPrintPayload() {
            String json = "{\"apiKey\":\"" + SECRET + "\"}";

            String output = captureOutput(() -> JsonUtils.parseMap(json));

            assertThat(output).doesNotContain(SECRET);
            assertThat(output).isEmpty();
        }

        @Test
        @DisplayName("parseMap 处理空值与非法 JSON 时也不打印到 stdout")
        void parseMapStaysQuietOnEdgeCases() {
            assertThat(captureOutput(() -> JsonUtils.parseMap(null))).isEmpty();
            assertThat(captureOutput(() -> JsonUtils.parseMap(""))).isEmpty();
            // 非法 JSON 走 log.error（SLF4J），不应出现在 stdout 的 println 里
            assertThat(captureOutput(() -> JsonUtils.parseMap("{ 不是合法 json"))).doesNotContain("JsonUtils Debug");
        }
    }

    @Nested
    @DisplayName("序列化功能本身")
    class Serialization {

        @Test
        @DisplayName("对象与 JSON 往返保真")
        void roundTrip() {
            String json = JsonUtils.toJsonString(providerConfigWithSecret());
            ProviderConfig back = JsonUtils.parseObject(json, ProviderConfig.class);

            assertThat(back.getApiKey()).isEqualTo(SECRET);
            assertThat(back.getBaseUrl()).isEqualTo("https://api.example.com");
        }

        @Test
        @DisplayName("null 序列化为 {}")
        void nullSerializesToEmptyObject() {
            assertThat(JsonUtils.toJsonString(null)).isEqualTo("{}");
        }

        @Test
        @DisplayName("parseMap 正常解析")
        void parseMapWorks() {
            Map<String, Object> map = JsonUtils.parseMap("{\"k\":\"v\"}");

            assertThat(map).containsEntry("k", "v");
        }

        @Test
        @DisplayName("parseMap 遇空输入返回 null")
        void parseMapReturnsNullOnBlank() {
            assertThat(JsonUtils.parseMap(null)).isNull();
            assertThat(JsonUtils.parseMap("")).isNull();
        }
    }
}
