package org.lucas.infrastructure.utils;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.lucas.infrastructure.exception.BusinessException;

/** ConfigCrypto 的行为约束。
 *
 * <p>
 * 这些用例锁定的是安全属性，不是实现细节：密钥必须来自环境变量、相同明文不能产生相同密文、
 * 密文被篡改必须失败、以及存量旧格式数据仍可读取。 */
class ConfigCryptoTest {

    private static final String TEST_KEY = "test-key-do-not-use-in-production";
    private static final String LEGACY_KEY = "1234567890123456";

    @BeforeEach
    void setUp() {
        ConfigCrypto.overrideKeyForTesting(TEST_KEY);
    }

    @AfterEach
    void tearDown() {
        ConfigCrypto.overrideKeyForTesting(null);
    }

    @Test
    @DisplayName("加密后能原样解回")
    void roundTrip() {
        String plaintext = "{\"apiKey\":\"sk-secret-value\",\"baseUrl\":\"https://api.example.com\"}";

        String encrypted = ConfigCrypto.encrypt(plaintext);

        assertAll(() -> assertNotEquals(plaintext, encrypted, "密文不应等于明文"),
                () -> assertFalse(encrypted.contains("sk-secret-value"), "密文中不应出现明文片段"),
                () -> assertEquals(plaintext, ConfigCrypto.decrypt(encrypted)));
    }

    @Test
    @DisplayName("相同明文两次加密结果不同（随机 IV，避免 ECB 那种可做模式分析的问题）")
    void sameInputProducesDifferentCiphertext() {
        String plaintext = "same-content";

        String first = ConfigCrypto.encrypt(plaintext);
        String second = ConfigCrypto.encrypt(plaintext);

        assertAll(() -> assertNotEquals(first, second, "相同明文必须产生不同密文"),
                () -> assertEquals(plaintext, ConfigCrypto.decrypt(first)),
                () -> assertEquals(plaintext, ConfigCrypto.decrypt(second)));
    }

    @Test
    @DisplayName("密文被篡改时解密失败，而不是返回垃圾数据")
    void tamperedCiphertextIsRejected() {
        String encrypted = ConfigCrypto.encrypt("sensitive");

        // 翻转 Base64 载荷中的一个字符
        String payload = encrypted.substring("v2:".length());
        char[] chars = payload.toCharArray();
        chars[chars.length - 2] = chars[chars.length - 2] == 'A' ? 'B' : 'A';
        String tampered = "v2:" + new String(chars);

        assertThrows(BusinessException.class, () -> ConfigCrypto.decrypt(tampered));
    }

    @Test
    @DisplayName("换一把密钥解不出原密文")
    void wrongKeyCannotDecrypt() {
        String encrypted = ConfigCrypto.encrypt("secret");

        ConfigCrypto.overrideKeyForTesting("a-completely-different-key");

        assertThrows(BusinessException.class, () -> ConfigCrypto.decrypt(encrypted));
    }

    @Test
    @DisplayName("环境变量缺失时必须报错，不能回落到默认密钥")
    void missingKeyFailsFast() {
        ConfigCrypto.overrideKeyForTesting(null);

        IllegalStateException e = assertThrows(IllegalStateException.class, ConfigCrypto::validateConfiguration);
        assertTrue(e.getMessage().contains(ConfigCrypto.KEY_ENV));
    }

    @Test
    @DisplayName("拒绝沿用已泄露的旧硬编码密钥")
    void rejectsLeakedLegacyKey() {
        ConfigCrypto.overrideKeyForTesting(LEGACY_KEY);

        assertThrows(IllegalStateException.class, ConfigCrypto::validateConfiguration);
    }

    @Test
    @DisplayName("旧格式数据仍能读取（保证升级后存量配置不失效）")
    void legacyCiphertextRemainsReadable() throws Exception {
        String plaintext = "{\"apiKey\":\"legacy-key\"}";
        String legacyCiphertext = encryptWithLegacyScheme(plaintext);

        assertAll(() -> assertFalse(ConfigCrypto.isNewFormat(legacyCiphertext), "旧格式不应带 v2 前缀"),
                () -> assertEquals(plaintext, ConfigCrypto.decrypt(legacyCiphertext)));
    }

    @Test
    @DisplayName("新写入的一律是新格式")
    void newWritesUseNewFormat() {
        assertTrue(ConfigCrypto.isNewFormat(ConfigCrypto.encrypt("anything")));
    }

    @Test
    @DisplayName("null 与空串按原样处理，不抛异常")
    void handlesNullAndEmpty() {
        assertAll(() -> assertNull(ConfigCrypto.encrypt(null)), () -> assertNull(ConfigCrypto.decrypt(null)),
                () -> assertEquals("", ConfigCrypto.decrypt("")));
    }

    /** 用旧实现的方式加密，模拟数据库里的存量数据。 */
    private static String encryptWithLegacyScheme(String data) throws Exception {
        SecretKeySpec key = new SecretKeySpec(LEGACY_KEY.getBytes(StandardCharsets.UTF_8), "AES");
        Cipher cipher = Cipher.getInstance("AES");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        return Base64.getEncoder().encodeToString(cipher.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }

}
