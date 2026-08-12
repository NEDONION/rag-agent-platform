package org.lucas.infrastructure.config;

import jakarta.annotation.PostConstruct;
import org.lucas.infrastructure.utils.ConfigCrypto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** 启动时校验配置加密密钥。
 *
 * <p>
 * ConfigCrypto 被 MyBatis 的 TypeHandler 使用，而 TypeHandler 由 MyBatis 而非 Spring 实例化，无法直接注入配置。
 * 因此这里用一个 Spring Bean 在启动阶段主动触发一次校验，让「密钥未配置」在启动时就暴露，而不是等到某个用户
 * 第一次读写服务商配置时才报错——那时故障已经发生在业务链路里，排查成本高得多。 */
@Component
public class ConfigCryptoInitializer {

    private static final Logger log = LoggerFactory.getLogger(ConfigCryptoInitializer.class);

    @PostConstruct
    public void verify() {
        ConfigCrypto.validateConfiguration();
        log.info("配置加密密钥校验通过（来源：环境变量 {}）", ConfigCrypto.KEY_ENV);
    }
}
