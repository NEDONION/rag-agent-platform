package org.lucas.infrastructure.utils;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collection;
import java.util.regex.Pattern;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.lucas.infrastructure.exception.BusinessException;
import org.lucas.infrastructure.exception.ParamValidationException;

/** 参数校验工具类 */
public class ValidationUtils {

    // 简化版语义化版本格式，例如 1.0.0
    private static final Pattern VERSION_PATTERN = Pattern.compile("^\\d+\\.\\d+\\.\\d+$");

    /** 校验参数不为空 */
    public static void notNull(Object value, String paramName) {
        if (value == null) {
            throw new ParamValidationException(paramName, "不能为空");
        }
    }

    /** 校验字符串不为空 */
    public static void notEmpty(String value, String paramName) {
        if (value == null || value.trim().isEmpty()) {
            throw new ParamValidationException(paramName, "不能为空");
        }
    }

    /** 校验集合不为空 */
    public static void notEmpty(Collection<?> collection, String paramName) {
        if (collection == null || collection.isEmpty()) {
            throw new ParamValidationException(paramName, "不能为空");
        }
    }

    /** 校验字符串长度 */
    public static void length(String value, int min, int max, String paramName) {
        if (value == null) {
            throw new ParamValidationException(paramName, "不能为空");
        }

        int length = value.length();
        if (length < min || length > max) {
            throw new ParamValidationException(paramName, String.format("长度必须在%d-%d之间，当前长度: %d", min, max, length));
        }
    }

    /** 校验数值范围 */
    public static void range(int value, int min, int max, String paramName) {
        if (value < min || value > max) {
            throw new ParamValidationException(paramName, String.format("必须在%d-%d之间，当前值: %d", min, max, value));
        }
    }

    /** 校验版本号格式是否正确 */
    public static void validVersionFormat(String version, String paramName) {
        notEmpty(version, paramName);
        if (!VERSION_PATTERN.matcher(version).matches()) {
            throw new ParamValidationException(paramName, "版本号格式不正确，应为 X.Y.Z 格式，例如 1.0.0");
        }
    }

    /** 加密工具类
     *
     * <p>密文格式分两代：
     *
     * <ul>
     * <li><b>v2（当前）</b>：{@code v2:} + Base64(IV ‖ 密文 ‖ GCM Tag)，AES/GCM/NoPadding，
     * 密钥来自环境变量 {@code CONFIG_ENCRYPTION_KEY}。每次加密使用随机 IV，相同明文产生不同密文。
     * <li><b>v1（遗留，只读）</b>：Base64(密文)，AES/ECB，密钥曾硬编码在本仓库中。
     * </ul>
     *
     * <p>{@link #decrypt} 同时支持两种格式，因此升级<b>不需要数据迁移</b>：存量记录仍可读，
     * 任何一次写回都会自动升级为 v2。{@link #encrypt} 只产出 v2。
     *
     * <p><b>注意</b>：v1 密钥已随公开仓库泄露，所有仍为 v1 格式的服务商密钥都应视为已泄露，
     * 需要通知用户轮换。 */
    public static class EncryptUtils {

        /** 环境变量名；亦可通过同名 JVM 系统属性提供 */
        static final String KEY_NAME = "CONFIG_ENCRYPTION_KEY";

        private static final String TRANSFORMATION = "AES/GCM/NoPadding";
        private static final String KEY_ALGORITHM = "AES";
        private static final String V2_PREFIX = "v2:";
        private static final int IV_LENGTH = 12;
        private static final int TAG_LENGTH_BITS = 128;

        /** v1 遗留参数：仅用于解密存量数据，绝不用于加密 */
        private static final String LEGACY_ALGORITHM = "AES";
        private static final String LEGACY_SECRET_KEY = "1234567890123456";

        private static final SecureRandom SECURE_RANDOM = new SecureRandom();

        private static volatile SecretKeySpec cachedKey;

        private EncryptUtils() {
            // 私有构造函数，防止实例化
        }

        /** 校验加密密钥已正确配置，未配置或格式非法时抛出异常。
         *
         * <p>由 {@code EncryptionKeyValidator} 在启动时调用，使配置缺失表现为启动失败，
         * 而不是等到第一次读写服务商配置时才在运行期爆炸。 */
        public static void ensureKeyConfigured() {
            resolveKey();
        }

        /** 用 Spring 解析出的配置值设置密钥。
         *
         * <p>本类是静态工具类（被 MyBatis TypeHandler 直接调用，不走 Spring 容器），
         * 默认只能读环境变量。此方法让 {@code EncryptionKeyValidator} 把 Spring
         * {@code Environment} 解析的值灌进来，从而支持 `application-local.yml` 等配置源，
         * 便于 IDE 本地调试。传入空值时不做任何事，由 {@link #ensureKeyConfigured()} 走环境变量兜底。 */
        public static void configureKey(String rawKey) {
            if (rawKey == null || rawKey.trim().isEmpty()) {
                return;
            }
            byte[] keyBytes = parseKeyBytes(rawKey.trim());
            synchronized (EncryptUtils.class) {
                cachedKey = new SecretKeySpec(keyBytes, KEY_ALGORITHM);
            }
        }

        /** 加密字符串
         *
         * @param data 待加密的字符串
         * @return v2 格式的密文 */
        public static String encrypt(String data) {
            if (data == null) {
                return null;
            }
            try {
                byte[] iv = new byte[IV_LENGTH];
                SECURE_RANDOM.nextBytes(iv);

                Cipher cipher = Cipher.getInstance(TRANSFORMATION);
                cipher.init(Cipher.ENCRYPT_MODE, resolveKey(), new GCMParameterSpec(TAG_LENGTH_BITS, iv));
                byte[] cipherText = cipher.doFinal(data.getBytes(StandardCharsets.UTF_8));

                byte[] payload = new byte[iv.length + cipherText.length];
                System.arraycopy(iv, 0, payload, 0, iv.length);
                System.arraycopy(cipherText, 0, payload, iv.length, cipherText.length);
                return V2_PREFIX + Base64.getEncoder().encodeToString(payload);
            } catch (BusinessException e) {
                throw e;
            } catch (Exception e) {
                throw new BusinessException("加密失败: " + e.getMessage(), e);
            }
        }

        /** 解密字符串，自动识别 v2 与 v1 遗留格式
         *
         * @param encryptedData 已加密的字符串
         * @return 解密后的字符串 */
        public static String decrypt(String encryptedData) {
            if (encryptedData == null) {
                return null;
            }
            return encryptedData.startsWith(V2_PREFIX)
                    ? decryptV2(encryptedData.substring(V2_PREFIX.length()))
                    : decryptLegacy(encryptedData);
        }

        private static String decryptV2(String payloadBase64) {
            try {
                byte[] payload = Base64.getDecoder().decode(payloadBase64);
                if (payload.length <= IV_LENGTH) {
                    throw new BusinessException("解密失败: 密文长度不合法");
                }
                byte[] iv = Arrays.copyOfRange(payload, 0, IV_LENGTH);
                byte[] cipherText = Arrays.copyOfRange(payload, IV_LENGTH, payload.length);

                Cipher cipher = Cipher.getInstance(TRANSFORMATION);
                cipher.init(Cipher.DECRYPT_MODE, resolveKey(), new GCMParameterSpec(TAG_LENGTH_BITS, iv));
                return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
            } catch (BusinessException e) {
                throw e;
            } catch (Exception e) {
                throw new BusinessException("解密失败: " + e.getMessage(), e);
            }
        }

        /** 解密 v1 遗留密文。密钥已公开泄露，此路径仅为兼容存量数据而保留。 */
        private static String decryptLegacy(String encryptedData) {
            try {
                SecretKeySpec secretKey = new SecretKeySpec(LEGACY_SECRET_KEY.getBytes(StandardCharsets.UTF_8),
                        LEGACY_ALGORITHM);
                Cipher cipher = Cipher.getInstance(LEGACY_ALGORITHM);
                cipher.init(Cipher.DECRYPT_MODE, secretKey);
                byte[] decryptedBytes = cipher.doFinal(Base64.getDecoder().decode(encryptedData));
                return new String(decryptedBytes, StandardCharsets.UTF_8);
            } catch (Exception e) {
                throw new BusinessException("解密失败: " + e.getMessage(), e);
            }
        }

        /** 解析加密密钥。接受 Base64 编码值，或长度为 16/24/32 的原始字符串。 */
        private static SecretKeySpec resolveKey() {
            SecretKeySpec key = cachedKey;
            if (key != null) {
                return key;
            }
            synchronized (EncryptUtils.class) {
                if (cachedKey == null) {
                    cachedKey = new SecretKeySpec(readKeyBytes(), KEY_ALGORITHM);
                }
                return cachedKey;
            }
        }

        private static byte[] readKeyBytes() {
            String raw = System.getenv(KEY_NAME);
            if (raw == null || raw.trim().isEmpty()) {
                raw = System.getProperty(KEY_NAME);
            }
            if (raw == null || raw.trim().isEmpty()) {
                throw new BusinessException("缺少环境变量 " + KEY_NAME
                        + "：服务商配置的加密密钥必须显式注入，不提供默认值。"
                        + "可用 `openssl rand -base64 32` 生成后写入 .env。");
            }
            return parseKeyBytes(raw.trim());
        }

        /** 解析密钥字符串：优先按 Base64 解码，失败或长度不符则按原始字符串取 UTF-8 字节。 */
        private static byte[] parseKeyBytes(String raw) {
            try {
                byte[] decoded = Base64.getDecoder().decode(raw);
                if (isValidAesKeyLength(decoded.length)) {
                    return decoded;
                }
            } catch (IllegalArgumentException ignored) {
                // 不是合法 Base64，按原始字符串处理
            }

            byte[] rawBytes = raw.getBytes(StandardCharsets.UTF_8);
            if (!isValidAesKeyLength(rawBytes.length)) {
                throw new BusinessException(KEY_NAME + " 长度不合法：需为 Base64 编码的 16/24/32 字节密钥，"
                        + "或长度为 16/24/32 的原始字符串，当前为 " + rawBytes.length + " 字节。");
            }
            return rawBytes;
        }

        private static boolean isValidAesKeyLength(int length) {
            return length == 16 || length == 24 || length == 32;
        }
    }
}