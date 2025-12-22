package org.lucas.interfaces.api.portal.user;

import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.lucas.application.llm.dto.ModelDTO;
import org.lucas.application.llm.service.LLMAppService;
import org.lucas.application.user.dto.UserDTO;
import org.lucas.application.user.dto.UserSettingsDTO;
import org.lucas.application.user.service.UserAppService;
import org.lucas.application.user.service.UserSettingsAppService;
import org.lucas.domain.llm.model.enums.ModelType;
import org.lucas.domain.llm.model.enums.ProviderType;
import org.lucas.infrastructure.auth.UserContext;
import org.lucas.interfaces.api.common.Result;
import org.lucas.interfaces.dto.user.request.ChangePasswordRequest;
import org.lucas.interfaces.dto.user.request.UserSettingsUpdateRequest;
import org.lucas.interfaces.dto.user.request.UserUpdateRequest;

/** 用户 */
@RestController
@RequestMapping("/users")
public class PortalUserController {

    private final UserAppService userAppService;

    private final UserSettingsAppService userSettingsAppService;

    private final LLMAppService llmAppService;

    public PortalUserController(UserAppService userAppService, UserSettingsAppService userSettingsAppService,
            LLMAppService llmAppService) {
        this.userAppService = userAppService;
        this.userSettingsAppService = userSettingsAppService;
        this.llmAppService = llmAppService;
    }

    /** 获取用户信息
     * @return */
    @GetMapping
    public Result<UserDTO> getUserInfo() {
        String userId = UserContext.getCurrentUserId();
        return Result.success(userAppService.getUserInfo(userId));
    }

    /** 修改用户信息
     * @param userUpdateRequest 需要修改的信息
     * @return */
    @PostMapping
    public Result<?> updateUserInfo(@RequestBody @Validated UserUpdateRequest userUpdateRequest) {
        String userId = UserContext.getCurrentUserId();
        userAppService.updateUserInfo(userUpdateRequest, userId);
        return Result.success();
    }

    /** 修改密码
     * 
     * @param request 修改密码请求
     * @return 修改结果 */
    @PutMapping("/password")
    public Result<?> updatePassword(@RequestBody @Validated ChangePasswordRequest request) {
        String userId = UserContext.getCurrentUserId();
        userAppService.changePassword(request, userId);
        return Result.success().message("密码修改成功");
    }

    /** 获取用户设置
     * @return 用户设置信息 */
    @GetMapping("/settings")
    public Result<UserSettingsDTO> getUserSettings() {
        String userId = UserContext.getCurrentUserId();
        UserSettingsDTO settings = userSettingsAppService.getUserSettings(userId);
        return Result.success(settings);
    }

    /** 更新用户设置
     * @param request 更新请求
     * @return 更新后的用户设置 */
    @PutMapping("/settings")
    public Result<UserSettingsDTO> updateUserSettings(@RequestBody @Validated UserSettingsUpdateRequest request) {
        String userId = UserContext.getCurrentUserId();
        UserSettingsDTO settings = userSettingsAppService.updateUserSettings(request, userId);
        return Result.success(settings);
    }

    /** 获取用户默认模型ID
     * @return 默认模型ID */
    @GetMapping("/settings/default-model")
    public Result<String> getUserDefaultModelId() {
        String userId = UserContext.getCurrentUserId();
        String defaultModelId = userSettingsAppService.getUserDefaultModelId(userId);
        return Result.success(defaultModelId);
    }

    /** 获取可用的视觉模型列表
     * @return 视觉模型列表 */
    @GetMapping("/settings/ocr-models")
    public Result<List<ModelDTO>> getOcrModels() {
        String userId = UserContext.getCurrentUserId();
        List<ModelDTO> models = llmAppService.getActiveModelsByType(ProviderType.ALL, userId, ModelType.VISION);
        return Result.success(models);
    }

    /** 获取可用的嵌入模型列表（按模型类型筛选）
     * @return 嵌入模型列表 */
    @GetMapping("/settings/embedding-models")
    public Result<List<ModelDTO>> getEmbeddingModels() {
        String userId = UserContext.getCurrentUserId();
        // 筛选嵌入模型类型
        List<ModelDTO> models = llmAppService.getActiveModelsByType(ProviderType.ALL, userId, ModelType.EMBEDDING);
        return Result.success(models);
    }
}
