package org.lucas.infrastructure.config;

import java.util.List;
import org.lucas.domain.llm.model.ProviderEntity;
import org.lucas.domain.llm.repository.ProviderRepository;
import org.lucas.infrastructure.utils.ConfigCrypto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** 把旧格式加密的服务商配置迁移为新格式。
 *
 * <p>
 * 默认不执行。设置环境变量 {@code CONFIG_CRYPTO_MIGRATE=true} 后于启动时运行一次，完成后应把该变量去掉。
 *
 * <p>
 * <b>为什么还需要它</b>：{@link ConfigCrypto} 读取时兼容旧格式，写入时一律用新格式，所以数据本来会随使用
 * 逐步迁移。但「逐步」意味着不活跃的记录会长期以旧格式留存，而旧格式的密钥已随公开仓库泄露。这个任务
 * 把存量数据一次性转完，之后才能安全地删除旧格式解密逻辑。
 *
 * <p>
 * <b>注意</b>：迁移只改变加密方式，<b>不会</b>让已泄露的 API Key 重新变得安全。存量密钥应视为已泄露，
 * 需要通知用户轮换。 */
@Component
public class ConfigCryptoMigration implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ConfigCryptoMigration.class);

    private static final String MIGRATE_ENV = "CONFIG_CRYPTO_MIGRATE";

    private final ProviderRepository providerRepository;

    public ConfigCryptoMigration(ProviderRepository providerRepository) {
        this.providerRepository = providerRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!"true".equalsIgnoreCase(System.getenv(MIGRATE_ENV))) {
            return;
        }

        log.info("检测到 {}=true，开始迁移服务商配置的加密格式", MIGRATE_ENV);

        List<ProviderEntity> providers = providerRepository.selectList(null);
        int migrated = 0;
        int failed = 0;

        for (ProviderEntity provider : providers) {
            try {
                // 读取时 TypeHandler 已按旧格式解密；这里原样写回，
                // 写入时 TypeHandler 会用新格式重新加密。
                if (provider.getConfig() == null) {
                    continue;
                }
                providerRepository.updateById(provider);
                migrated++;
            } catch (Exception e) {
                failed++;
                // 不打印配置内容，避免密钥进日志
                log.error("迁移服务商配置失败: providerId={}", provider.getId(), e);
            }
        }

        log.info("配置加密格式迁移完成：成功 {} 条，失败 {} 条，共 {} 条。" + "请移除 {} 环境变量，并通知用户轮换其模型服务商 API Key"
                + "（旧密钥已随公开仓库泄露）。", migrated, failed, providers.size(), MIGRATE_ENV);
    }
}
