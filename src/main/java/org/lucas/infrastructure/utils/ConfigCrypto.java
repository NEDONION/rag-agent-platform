package org.lucas.infrastructure.utils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.lucas.infrastructure.exception.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** 敏感配置的加解密工具。
 *
 * 用于服务商配置（内含用户填写的模型 API Key）的落库加密，见 ProviderConfigConverter。
 *
 * <p>
 * <b>为什么重写</b>：旧实现把 AES 密钥硬编码在源码里（{@code "1234567890123456"}），而本仓库是公开的
 * ——密钥等同于公开信息，加密形同虚设；且使用默认的 ECB 模式，相同明文会产生相同密文。任何拿到数据库
 * 内容的人都能解出全部用户的服务商密钥。
 *
 * <p>
 * <b>现在的做法</b>：密钥由环境变量 {@code CONFIG_ENCRYPTION_KEY} 注入，缺失时启动即失败（不回落到
 * 任何默认值）；加密使用 AES/GCM，每条记录随机 IV，并带认证标签，密文被篡改会解密失败而非返回垃圾数据。
 *
 * <p>
 * <b>密文格式</b>：{@code v2:} + Base64(IV ‖ 密文+认证标签)。前缀用于与历史数据区分。
 *
 * <p>
 * <b>兼容历史数据</b>：不带 {@code v2:} 前缀的密文按旧格式（ECB + 硬编码密钥）解密，以便存量数据仍可读取。
 * 任何一次写入都会转成新格式，因此数据会随使用逐步完成迁移；也可用
 * {@code ConfigCryptoMigration} 一次性迁移。存量数据全部迁移完成后，应删除
 * {@link #decryptLegacy(String)} 及相关常量。 */
public final class ConfigCrypto {

    private static final Logger log = LoggerFactory.getLogger(ConfigCrypto.class);

    /** 注入加密密钥的环境变量名。 */
    public static final String KEY_ENV = "CONFIG_ENCRYPTION_KEY";

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final String KEY_ALGORITHM = "AES";
    private static final String VERSION_PREFIX = "v2:";
    /** GCM 推荐的 IV 长度（字节）。 */
    private static final int IV_LENGTH = 12;
    /** GCM 认证标签长度（位）。 */
    private static final int TAG_LENGTH_BITS = 128;

    /** 旧实现的硬编码密钥。仅用于解密存量数据，绝不用于加密。 */
    private static final String LEGACY_KEY = "1234567890123456";
    private static final String LEGACY_TRANSFORMATION = "AES";

    private static final SecureRandom RANDOM = new SecureRandom();

    /** 由 {@link #KEY_ENV} 派生的密钥，首次使用时初始化。 */
    private static volatile SecretKeySpec cachedKey;
    /** 只在首次读到历史格式数据时打一次告警，避免刷屏。 */
    private static volatile boolean legacyWarned = false;
    /** 仅供同包测试注入密钥，生产运行时始终为 null。 */
    private static volatile String testKeyOverride;

    private ConfigCrypto() {
    }

    /** 校验密钥配置是否可用。由启动检查调用，使配置缺失在启动阶段就暴露，而不是等到第一次读写配置时。
     *
     * @throws IllegalStateException 环境变量缺失或为空 */
    public static void validateConfiguration() {
        resolveKey();
    }

    /** 加密。始终产出新格式（{@code v2:} 前缀）。
     *
     * @param plaintext 明文，为 null 时返回 null
     * @return 密文 */
    public static String encrypt(String plaintext) {
        if (plaintext == null) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_LENGTH];
            RANDOM.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, resolveKey(), new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            // IV 与密文拼在一起存储：IV 不是秘密，但解密时必须拿到同一个
            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);

            return VERSION_PREFIX + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            // 不带上原始明文，避免异常信息泄露密钥内容
            throw new BusinessException("配置加密失败: " + e.getMessage(), e);
        }
    }

    /** 解密。自动识别新旧格式。
     *
     * @param encrypted 密文，为 null 或空串时原样返回
     * @return 明文 */
    public static String decrypt(String encrypted) {
        if (encrypted == null || encrypted.isEmpty()) {
            return encrypted;
        }
        if (!encrypted.startsWith(VERSION_PREFIX)) {
            return decryptLegacy(encrypted);
        }
        try {
            byte[] combined = Base64.getDecoder().decode(encrypted.substring(VERSION_PREFIX.length()));
            if (combined.length <= IV_LENGTH) {
                throw new IllegalArgumentException("密文长度不足，无法取出 IV");
            }

            byte[] iv = new byte[IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, IV_LENGTH);
            byte[] ciphertext = new byte[combined.length - IV_LENGTH];
            System.arraycopy(combined, IV_LENGTH, ciphertext, 0, ciphertext.length);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, resolveKey(), new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new BusinessException("配置解密失败: " + e.getMessage(), e);
        }
    }

    /** 判断密文是否已是新格式。迁移工具据此跳过无需处理的数据。
     *
     * @param encrypted 密文
     * @return 是否为新格式 */
    public static boolean isNewFormat(String encrypted) {
        return encrypted != null && encrypted.startsWith(VERSION_PREFIX);
    }

    /** 按旧格式（AES/ECB + 硬编码密钥）解密存量数据。
     *
     * <p>
     * 存量数据全部迁移完成后应删除本方法。 */
    private static String decryptLegacy(String encrypted) {
        if (!legacyWarned) {
            legacyWarned = true;
            log.warn("检测到使用旧格式加密的配置数据。旧格式的密钥硬编码于源码中且仓库公开，"
                    + "应视为已泄露。请运行迁移将其转为新格式，并通知用户轮换相关 API Key。");
        }
        try {
            SecretKeySpec legacyKey = new SecretKeySpec(LEGACY_KEY.getBytes(StandardCharsets.UTF_8), KEY_ALGORITHM);
            Cipher cipher = Cipher.getInstance(LEGACY_TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, legacyKey);
            return new String(cipher.doFinal(Base64.getDecoder().decode(encrypted)), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new BusinessException("旧格式配置解密失败: " + e.getMessage(), e);
        }
    }

    /** 读取并派生密钥。
     *
     * <p>
     * 用 SHA-256 派生出固定的 256 位密钥，这样环境变量可以是任意长度的字符串，不必恰好 16/24/32 字节。
     * 注意派生不等于增强——环境变量本身仍应是高熵随机值。 */
    private static SecretKeySpec resolveKey() {
        SecretKeySpec key = cachedKey;
        if (key != null) {
            return key;
        }
        synchronized (ConfigCrypto.class) {
            if (cachedKey != null) {
                return cachedKey;
            }
            String raw = testKeyOverride != null ? testKeyOverride : System.getenv(KEY_ENV);
            if (raw == null || raw.isBlank()) {
                throw new IllegalStateException("缺少环境变量 " + KEY_ENV + "。该变量用于加密服务商配置中的 API Key，"
                        + "必须显式配置且不提供默认值。生成方式：openssl rand -base64 32");
            }
            if (LEGACY_KEY.equals(raw)) {
                throw new IllegalStateException(
                        KEY_ENV + " 不能使用旧的硬编码密钥值——它已随公开仓库泄露。请生成新密钥：openssl rand -base64 32");
            }
            try {
                byte[] derived = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
                cachedKey = new SecretKeySpec(derived, KEY_ALGORITHM);
                return cachedKey;
            } catch (Exception e) {
                throw new IllegalStateException("派生加密密钥失败: " + e.getMessage(), e);
            }
        }
    }

    /** 仅供测试使用：注入密钥并清除缓存。传 null 表示恢复为读取环境变量。
     *
     * <p>
     * 设计为包级私有，生产代码无法调用；测试因此不必去反射篡改 JVM 的环境变量表
     * （那种做法在 JDK 17 的模块系统下已不可行）。 */
    static void overrideKeyForTesting(String rawKey) {
        synchronized (ConfigCrypto.class) {
            testKeyOverride = rawKey;
            cachedKey = null;
            legacyWarned = false;
        }
    }
}
