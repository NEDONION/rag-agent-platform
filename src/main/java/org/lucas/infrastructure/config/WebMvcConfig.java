package org.lucas.infrastructure.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.lucas.infrastructure.auth.UserAuthInterceptor;
import org.lucas.infrastructure.interceptor.AdminAuthInterceptor;

/** Web MVC 配置类 用于配置拦截器、跨域等 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final UserAuthInterceptor userAuthInterceptor;
    private final AdminAuthInterceptor adminAuthInterceptor;

    public WebMvcConfig(UserAuthInterceptor userAuthInterceptor, AdminAuthInterceptor adminAuthInterceptor) {
        this.userAuthInterceptor = userAuthInterceptor;
        this.adminAuthInterceptor = adminAuthInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(userAuthInterceptor).addPathPatterns("/**") // 拦截所有请求
                .excludePathPatterns( // 不拦截以下路径
                        "/login", // 登录接口
                        "/api/login", // 登录接口（兼容上下文路径）
                        "/health", // 健康检查接口
                        "/api/health", // 健康检查接口（兼容上下文路径）
                        "/register", // 注册接口
                        "/api/register", // 注册接口（兼容上下文路径）
                        "/auth/config", // 认证配置接口
                        "/api/auth/config", // 认证配置接口（兼容上下文路径）
                        "/send-email-code", "/verify-email-code", "/get-captcha", "/reset-password",
                        "/send-reset-password-code",
                        "/api/send-email-code", "/api/verify-email-code", "/api/get-captcha", "/api/reset-password",
                        "/api/send-reset-password-code",
                        "/oauth/github/authorize", "/oauth/github/callback", "/sso/**", // SSO相关接口
                        "/api/oauth/github/authorize", "/api/oauth/github/callback", "/api/sso/**", // SSO相关接口（兼容上下文路径）
                        "/v1/**", "/payments/callback/**"); // 外部API接口，使用专门的API
        // Key拦截器

        // 管理员权限拦截器，只拦截admin路径
        registry.addInterceptor(adminAuthInterceptor).addPathPatterns("/admin/**");
    }
}
