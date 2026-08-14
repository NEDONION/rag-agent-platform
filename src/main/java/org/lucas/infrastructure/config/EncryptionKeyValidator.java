package org.lucas.infrastructure.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.lucas.infrastructure.utils.ValidationUtils;

/** 启动时校验服务商配置的加密密钥已注入。
 *
 * <p>密钥缺失或格式非法时直接让应用启动失败——服务商 API Key 在库中依赖它加密，
 * 若放任启动，故障会推迟到第一次读写服务商配置时才暴露，且可能以「解密失败」的形式
 * 出现在用户请求链路上。
 *
 * <p>密钥优先取 Spring 解析的 {@code config.encryption.key}（覆盖 `application-local.yml`
 * 等配置源，便于 IDE 调试），未配置时回落到 {@code CONFIG_ENCRYPTION_KEY} 环境变量。 */
@Component
public class EncryptionKeyValidator {

    private static final Logger logger = LoggerFactory.getLogger(EncryptionKeyValidator.class);

    private final String configuredKey;

    public EncryptionKeyValidator(@Value("${config.encryption.key:}") String configuredKey) {
        this.configuredKey = configuredKey;
    }

    @PostConstruct
    public void validate() {
        ValidationUtils.EncryptUtils.configureKey(configuredKey);
        ValidationUtils.EncryptUtils.ensureKeyConfigured();
        logger.info("服务商配置加密密钥已就绪（AES/GCM）");
    }
}
