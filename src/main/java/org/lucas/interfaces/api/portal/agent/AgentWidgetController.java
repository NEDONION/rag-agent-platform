package org.lucas.interfaces.api.portal.agent;

import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.lucas.application.agent.dto.AgentWidgetDTO;
import org.lucas.application.agent.service.AgentWidgetAppService;
import org.lucas.infrastructure.auth.UserContext;
import org.lucas.interfaces.api.common.Result;
import org.lucas.interfaces.dto.agent.request.CreateWidgetRequest;
import org.lucas.interfaces.dto.agent.request.UpdateWidgetRequest;

/** Agent小组件配置控制器 */
@RestController
@RequestMapping("/agents/{agentId}/widgets")
public class AgentWidgetController {

    private final AgentWidgetAppService agentWidgetAppService;

    public AgentWidgetController(AgentWidgetAppService agentWidgetAppService) {
        this.agentWidgetAppService = agentWidgetAppService;
    }

    /** 创建小组件配置
     *
     * @param agentId Agent ID
     * @param request 创建请求
     * @return 创建的小组件配置 */
    @PostMapping
    public Result<AgentWidgetDTO> createWidget(@PathVariable String agentId,
            @RequestBody @Validated CreateWidgetRequest request) {
        String userId = UserContext.getCurrentUserId();
        AgentWidgetDTO widget = agentWidgetAppService.createWidget(agentId, request, userId);
        return Result.success(widget);
    }

    /** 获取Agent的所有小组件配置
     *
     * @param agentId Agent ID
     * @return 小组件配置列表 */
    @GetMapping
    public Result<List<AgentWidgetDTO>> getWidgets(@PathVariable String agentId) {
        String userId = UserContext.getCurrentUserId();
        List<AgentWidgetDTO> widgets = agentWidgetAppService.getWidgetsByAgent(agentId, userId);
        return Result.success(widgets);
    }

    /** 获取小组件配置详情
     *
     * @param agentId Agent ID
     * @param widgetId 小组件配置ID
     * @return 小组件配置详情 */
    @GetMapping("/{widgetId}")
    public Result<AgentWidgetDTO> getWidgetDetail(@PathVariable String agentId, @PathVariable String widgetId) {
        String userId = UserContext.getCurrentUserId();
        AgentWidgetDTO widget = agentWidgetAppService.getWidgetDetail(widgetId, userId);
        return Result.success(widget);
    }

    /** 更新小组件配置
     *
     * @param agentId Agent ID
     * @param widgetId 小组件配置ID
     * @param request 更新请求
     * @return 更新后的小组件配置 */
    @PutMapping("/{widgetId}")
    public Result<AgentWidgetDTO> updateWidget(@PathVariable String agentId, @PathVariable String widgetId,
            @RequestBody @Validated UpdateWidgetRequest request) {
        String userId = UserContext.getCurrentUserId();
        AgentWidgetDTO widget = agentWidgetAppService.updateWidget(widgetId, request, userId);
        return Result.success(widget);
    }

    /** 切换小组件配置启用状态
     *
     * @param agentId Agent ID
     * @param widgetId 小组件配置ID
     * @return 更新后的小组件配置 */
    @PostMapping("/{widgetId}/status")
    public Result<AgentWidgetDTO> toggleWidgetStatus(@PathVariable String agentId, @PathVariable String widgetId) {
        String userId = UserContext.getCurrentUserId();
        AgentWidgetDTO widget = agentWidgetAppService.toggleWidgetStatus(widgetId, userId);
        return Result.success(widget);
    }

    /** 删除小组件配置
     *
     * @param agentId Agent ID
     * @param widgetId 小组件配置ID
     * @return 删除结果 */
    @DeleteMapping("/{widgetId}")
    public Result<Void> deleteWidget(@PathVariable String agentId, @PathVariable String widgetId) {
        String userId = UserContext.getCurrentUserId();
        agentWidgetAppService.deleteWidget(widgetId, userId);
        return Result.success();
    }
}

/** 用户小组件配置控制器 */
@RestController
@RequestMapping("/user/widgets")
class UserWidgetController {

    private final AgentWidgetAppService agentWidgetAppService;

    public UserWidgetController(AgentWidgetAppService agentWidgetAppService) {
        this.agentWidgetAppService = agentWidgetAppService;
    }

    /** 获取用户的所有小组件配置
     *
     * @return 小组件配置列表 */
    @GetMapping
    public Result<List<AgentWidgetDTO>> getUserWidgets() {
        String userId = UserContext.getCurrentUserId();
        List<AgentWidgetDTO> widgets = agentWidgetAppService.getWidgetsByUser(userId);
        return Result.success(widgets);
    }
}