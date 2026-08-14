package org.lucas.infrastructure.utils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.lucas.infrastructure.exception.BusinessException;
import org.lucas.infrastructure.utils.ValidationUtils.EncryptUtils;

/** {@link EncryptUtils} 的加解密行为。
 *
 * <p>这里守的是服务商 API Key 的落库加密——历史上它用硬编码密钥 + ECB 模式，
 * 密钥随公开仓库泄露。重点覆盖三件事：
 *
 * <ol>
 * <li>新的 v2（AES/GCM）格式往返正确，且相同明文不产生相同密文；
 * <li><b>v1 遗留密文仍可解密</b>——这是「升级无需数据迁移」的前提，一旦回归，
 * 线上所有存量服务商配置会立刻读不出来；
 * <li>密钥缺失或非法时抛异常，而不是回落到某个默认值继续跑。
 * </ol>
 */
class EncryptUtilsTest {

    /** Base64 编码的 32 字节密钥 */
    private static final String TEST_KEY = "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=";

    /** v1 遗留密钥，与生产代码 {@code LEGACY_SECRET_KEY} 保持一致，用于构造存量密文 */
    private static final String LEGACY_KEY = "1234567890123456";

    private static final String PROVIDER_CONFIG_JSON =
            "{\"apiKey\":\"sk-real-provider-key-abc123\",\"baseUrl\":\"https://api.example.com\"}";

    /** 清掉静态密钥缓存，让每个用例都能从干净状态决定密钥来源 */
    private static void resetKeyCache() {
        try {
            Field field = EncryptUtils.class.getDeclaredField("cachedKey");
            field.setAccessible(true);
            field.set(null, null);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("重置密钥缓存失败，EncryptUtils 内部字段可能已改名", e);
        }
    }

    /** 用 v1 的方式（旧密钥 + ECB）造一条密文，模拟库里的存量数据 */
    private static String legacyCiphertext(String plain) throws Exception {
        SecretKeySpec key = new SecretKeySpec(LEGACY_KEY.getBytes(StandardCharsets.UTF_8), "AES");
        Cipher cipher = Cipher.getInstance("AES");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        return Base64.getEncoder().encodeToString(cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8)));
    }

    @BeforeEach
    void setUp() {
        resetKeyCache();
        EncryptUtils.configureKey(TEST_KEY);
    }

    @Nested
    @DisplayName("v2（AES/GCM）加解密")
    class V2 {

        @Test
        @DisplayName("加密产物带 v2: 前缀，解密还原原文")
        void roundTrip() {
            String cipherText = EncryptUtils.encrypt(PROVIDER_CONFIG_JSON);

            assertThat(cipherText).startsWith("v2:");
            assertThat(EncryptUtils.decrypt(cipherText)).isEqualTo(PROVIDER_CONFIG_JSON);
        }

        @Test
        @DisplayName("相同明文两次加密产生不同密文（ECB 时代的核心缺陷）")
        void randomIvPerEncryption() {
            String first = EncryptUtils.encrypt(PROVIDER_CONFIG_JSON);
            String second = EncryptUtils.encrypt(PROVIDER_CONFIG_JSON);

            assertThat(first).isNotEqualTo(second);
            assertThat(EncryptUtils.decrypt(first)).isEqualTo(PROVIDER_CONFIG_JSON);
            assertThat(EncryptUtils.decrypt(second)).isEqualTo(PROVIDER_CONFIG_JSON);
        }

        @Test
        @DisplayName("中文与特殊字符不丢失")
        void handlesNonAsciiContent() {
            String text = "{\"备注\":\"密钥·测试 🔐\",\"apiKey\":\"sk-中文\"}";

            assertThat(EncryptUtils.decrypt(EncryptUtils.encrypt(text))).isEqualTo(text);
        }

        @Test
        @DisplayName("空字符串可正常往返")
        void handlesEmptyString() {
            assertThat(EncryptUtils.decrypt(EncryptUtils.encrypt(""))).isEmpty();
        }

        @Test
        @DisplayName("密文被篡改时 GCM 校验失败，不返回错误明文")
        void rejectsTamperedCiphertext() {
            String cipherText = EncryptUtils.encrypt(PROVIDER_CONFIG_JSON);
            byte[] payload = Base64.getDecoder().decode(cipherText.substring("v2:".length()));
            payload[payload.length - 1] ^= 0x01; // 翻转 GCM tag 最后一位
            String tampered = "v2:" + Base64.getEncoder().encodeToString(payload);

            assertThatThrownBy(() -> EncryptUtils.decrypt(tampered))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("解密失败");
        }

        @Test
        @DisplayName("密文长度不足以容纳 IV 时报错而非越界")
        void rejectsTruncatedCiphertext() {
            String truncated = "v2:" + Base64.getEncoder().encodeToString(new byte[8]);

            assertThatThrownBy(() -> EncryptUtils.decrypt(truncated))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("解密失败");
        }

        @Test
        @DisplayName("换一把密钥解不开原密文")
        void cannotDecryptWithDifferentKey() {
            String cipherText = EncryptUtils.encrypt(PROVIDER_CONFIG_JSON);

            resetKeyCache();
            EncryptUtils.configureKey("ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZg=");

            assertThatThrownBy(() -> EncryptUtils.decrypt(cipherText)).isInstanceOf(BusinessException.class);
        }
    }

    @Nested
    @DisplayName("v1 遗留密文兼容")
    class LegacyCompatibility {

        @Test
        @DisplayName("无前缀的旧密文仍能解开——升级不需要数据迁移")
        void decryptsLegacyCiphertext() throws Exception {
            String legacy = legacyCiphertext(PROVIDER_CONFIG_JSON);

            assertThat(legacy).doesNotStartWith("v2:");
            assertThat(EncryptUtils.decrypt(legacy)).isEqualTo(PROVIDER_CONFIG_JSON);
        }

        @Test
        @DisplayName("旧密文的解密不依赖新密钥（新密钥换了也读得出）")
        void legacyPathIsIndependentOfCurrentKey() throws Exception {
            String legacy = legacyCiphertext(PROVIDER_CONFIG_JSON);

            resetKeyCache();
            EncryptUtils.configureKey("ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZg=");

            assertThat(EncryptUtils.decrypt(legacy)).isEqualTo(PROVIDER_CONFIG_JSON);
        }

        @Test
        @DisplayName("重新加密后升级为 v2 格式")
        void rewriteUpgradesToV2() throws Exception {
            String legacy = legacyCiphertext(PROVIDER_CONFIG_JSON);

            String upgraded = EncryptUtils.encrypt(EncryptUtils.decrypt(legacy));

            assertThat(upgraded).startsWith("v2:");
            assertThat(EncryptUtils.decrypt(upgraded)).isEqualTo(PROVIDER_CONFIG_JSON);
        }
    }

    @Nested
    @DisplayName("密钥配置")
    class KeyConfiguration {

        /** 「密钥缺失」类用例只有在进程本身没配密钥时才成立。
         *
         * <p>开发者本地 shell 或 CI 里可能已导出 {@code CONFIG_ENCRYPTION_KEY}，
         * 那种情况下跳过而不是失败——测试不该因为环境里多了一个变量就变红。 */
        private void assumeNoAmbientKey() {
            assumeTrue(System.getenv(EncryptUtils.KEY_NAME) == null
                    && System.getProperty(EncryptUtils.KEY_NAME) == null,
                    "环境中已配置 " + EncryptUtils.KEY_NAME + "，跳过「密钥缺失」用例");
        }

        @Test
        @DisplayName("未配置密钥时抛出异常，不回落默认值")
        void failsWhenKeyMissing() {
            assumeNoAmbientKey();
            resetKeyCache();

            assertThatThrownBy(EncryptUtils::ensureKeyConfigured)
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("CONFIG_ENCRYPTION_KEY");
        }

        @Test
        @DisplayName("密钥长度非法时抛出异常")
        void rejectsInvalidKeyLength() {
            resetKeyCache();

            assertThatThrownBy(() -> EncryptUtils.configureKey("short"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("长度不合法");
        }

        @Test
        @DisplayName("接受 16 位原始字符串形式的密钥")
        void acceptsRawStringKey() {
            resetKeyCache();
            EncryptUtils.configureKey("abcdefghijklmnop");

            assertThat(EncryptUtils.decrypt(EncryptUtils.encrypt("x"))).isEqualTo("x");
        }

        @Test
        @DisplayName("configureKey 传入空值不生效，留给环境变量兜底")
        void blankConfiguredKeyIsIgnored() {
            assumeNoAmbientKey();
            resetKeyCache();

            assertThatCode(() -> EncryptUtils.configureKey("  ")).doesNotThrowAnyException();
            assertThatThrownBy(EncryptUtils::ensureKeyConfigured).isInstanceOf(BusinessException.class);
        }
    }

    @Nested
    @DisplayName("null 边界")
    class NullHandling {

        @Test
        @DisplayName("null 明文加密返回 null")
        void encryptNull() {
            assertThat(EncryptUtils.encrypt(null)).isNull();
        }

        @Test
        @DisplayName("null 密文解密返回 null")
        void decryptNull() {
            assertThat(EncryptUtils.decrypt(null)).isNull();
        }
    }
}
