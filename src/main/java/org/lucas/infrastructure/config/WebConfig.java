package org.lucas.infrastructure.config;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Web通用配置 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private static final Logger logger = LoggerFactory.getLogger(WebConfig.class);

    /** 允许的前端来源。逗号分隔，支持 Spring 的 origin pattern 语法（如 {@code http://localhost:[*]}）。
     *
     * <p>默认放开本机任意端口：dev server 端口被占用时会自动换端口，写死 3000 会让前端
     * 拿到一个 403 且响应体为空的请求——这个错误在浏览器里表现为「Forbidden」，
     * 既不提示是 CORS，也不说明是哪个来源被拒，排查成本很高。
     *
     * <p><b>生产环境应显式配置为真实域名</b>，例如：
     * {@code CORS_ALLOWED_ORIGINS=https://app.example.com}。 */
    @Value("${cors.allowed-origins:http://localhost:[*],http://127.0.0.1:[*],http://localhost,http://127.0.0.1}")
    private String allowedOrigins;

    /** 配置CORS过滤器 */
    @Bean
    public FilterRegistrationBean<CorsFilter> corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        // 用 OriginPattern 而非 Origin：allowCredentials(true) 与 "*" 冲突，
        // 而 pattern 支持端口通配，两者可以共存。
        List<String> origins = List.of(allowedOrigins.split(",")).stream().map(String::trim)
                .filter(s -> !s.isEmpty()).toList();
        origins.forEach(config::addAllowedOriginPattern);
        logger.info("CORS 允许的来源: {}", origins);
        // 允许携带认证信息
        config.setAllowCredentials(true);
        // 允许所有请求方法
        config.addAllowedMethod("*");
        // 允许所有请求头
        config.addAllowedHeader("*");
        // 预检请求有效期(秒)
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        FilterRegistrationBean<CorsFilter> bean = new FilterRegistrationBean<>(new CorsFilter(source));
        // 设置过滤器优先级最高
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return bean;
    }

    /** 配置异步请求处理 设置默认的异步请求超时时间 */
    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        // 设置异步请求超时时间为5分钟
        configurer.setDefaultTimeout(300000);
        // 设置任务执行器
        // configurer.setTaskExecutor(...); // 如果需要自定义线程池可以在这里设置
    }
}
