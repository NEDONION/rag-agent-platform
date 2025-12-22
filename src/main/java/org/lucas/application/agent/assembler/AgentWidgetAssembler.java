package org.lucas.application.agent.assembler;

import java.util.Collections;
import java.util.List;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.lucas.application.agent.dto.AgentWidgetDTO;
import org.lucas.application.llm.dto.ModelDTO;
import org.lucas.application.llm.dto.ProviderDTO;
import org.lucas.domain.agent.model.AgentWidgetEntity;
import org.lucas.interfaces.dto.agent.request.CreateWidgetRequest;
import org.lucas.interfaces.dto.agent.request.UpdateWidgetRequest;

/** Agent小组件配置转换器 */
@Component
public class AgentWidgetAssembler {

    @Value("${agentx.frontend.base-url:http://localhost:3000}")
    public String frontendBaseUrl;

    /** 将Entity转换为DTO
     *
     * @param entity 小组件配置实体
     * @param model 模型DTO
     * @param provider 服务商DTO
     * @return 小组件配置DTO */
    public static AgentWidgetDTO toDTO(AgentWidgetEntity entity, ModelDTO model, ProviderDTO provider) {
        if (entity == null) {
            return null;
        }

        AgentWidgetDTO dto = new AgentWidgetDTO();
        BeanUtils.copyProperties(entity, dto);
        dto.setModel(model);
        dto.setProvider(provider);

        return dto;
    }

    /** 将Entity转换为DTO（带嵌入代码）
     *
     * @param entity 小组件配置实体
     * @param model 模型DTO
     * @param provider 服务商DTO
     * @param frontendBaseUrl 前端基础URL
     * @return 小组件配置DTO */
    public static AgentWidgetDTO toDTOWithEmbedCode(AgentWidgetEntity entity, ModelDTO model, ProviderDTO provider,
            String frontendBaseUrl) {
        AgentWidgetDTO dto = toDTO(entity, model, provider);
        if (dto != null) {
            dto.setWidgetCode(generateEmbedCode(entity.getPublicId(), frontendBaseUrl));
        }
        return dto;
    }

    /** 将CreateWidgetRequest转换为Entity
     *
     * @param request 创建小组件请求
     * @param agentId Agent ID
     * @param userId 用户ID
     * @return 小组件配置实体 */
    public static AgentWidgetEntity toEntity(CreateWidgetRequest request, String agentId, String userId) {
        return AgentWidgetEntity.createNew(agentId, userId, request.getName(), request.getDescription(),
                request.getModelId(), request.getProviderId(), request.getAllowedDomains(), request.getDailyLimit(),
                request.getWidgetType(), request.getKnowledgeBaseIds());
    }

    /** 根据UpdateWidgetRequest更新Entity
     *
     * @param entity 要更新的实体
     * @param request 更新请求 */
    public static void updateEntity(AgentWidgetEntity entity, UpdateWidgetRequest request) {
        entity.updateConfig(request.getName(), request.getDescription(), request.getModelId(), request.getProviderId(),
                request.getAllowedDomains(), request.getDailyLimit(), request.getWidgetType(),
                request.getKnowledgeBaseIds());
        entity.setEnabled(request.getEnabled());
    }

    /** 将Entity列表转换为DTO列表
     *
     * @param entities 实体列表
     * @param models 模型列表（按实体顺序）
     * @param providers 服务商列表（按实体顺序）
     * @return DTO列表 */
    public static List<AgentWidgetDTO> toDTOs(List<AgentWidgetEntity> entities, List<ModelDTO> models,
            List<ProviderDTO> providers) {
        if (entities == null || entities.isEmpty()) {
            return Collections.emptyList();
        }

        return entities.stream().map(entity -> {
            int index = entities.indexOf(entity);
            ModelDTO model = models != null && index < models.size() ? models.get(index) : null;
            ProviderDTO provider = providers != null && index < providers.size() ? providers.get(index) : null;
            return toDTO(entity, model, provider);
        }).toList();
    }

    /** 将Entity列表转换为带嵌入代码的DTO列表
     *
     * @param entities 实体列表
     * @param models 模型列表
     * @param providers 服务商列表
     * @param frontendBaseUrl 前端基础URL
     * @return DTO列表 */
    public static List<AgentWidgetDTO> toDTOsWithEmbedCode(List<AgentWidgetEntity> entities, List<ModelDTO> models,
            List<ProviderDTO> providers, String frontendBaseUrl) {
        if (entities == null || entities.isEmpty()) {
            return Collections.emptyList();
        }

        return entities.stream().map(entity -> {
            int index = entities.indexOf(entity);
            ModelDTO model = models != null && index < models.size() ? models.get(index) : null;
            ProviderDTO provider = providers != null && index < providers.size() ? providers.get(index) : null;
            return toDTOWithEmbedCode(entity, model, provider, frontendBaseUrl);
        }).toList();
    }

    /** 生成嵌入代码
     *
     * @param publicId 公开访问ID
     * @param baseUrl 基础URL
     * @return 嵌入HTML代码 */
    private static String generateEmbedCode(String publicId, String baseUrl) {
        return String.format("""
                <!-- AgentX 智能助手小组件嵌入代码 -->
                <iframe
                  src="%s/widget/%s"
                  width="400"
                  height="600"
                  frameborder="0"
                  style="border: 1px solid #e2e8f0; border-radius: 8px;"
                  allow="microphone">
                </iframe>

                <!-- 或者使用悬浮窗模式 -->
                <script>
                  (function() {
                    const agentButton = document.createElement('div');
                    agentButton.innerHTML = '💬 智能助手';

                    // 按钮样式（格式化为多行）
                    agentButton.style.position = 'fixed';
                    agentButton.style.bottom = '20px';
                    agentButton.style.right = '20px';
                    agentButton.style.zIndex = '9999';
                    agentButton.style.background = '#007bff';
                    agentButton.style.color = 'white';
                    agentButton.style.padding = '12px 20px';
                    agentButton.style.borderRadius = '25px';
                    agentButton.style.cursor = 'pointer';
                    agentButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    agentButton.style.fontFamily = 'sans-serif';

                    agentButton.onclick = function() {
                      const iframe = document.createElement('iframe');
                      iframe.src = '%s/widget/%s';

                      // iframe样式（格式化为多行）
                      iframe.style.position = 'fixed';
                      iframe.style.bottom = '80px';
                      iframe.style.right = '20px';
                      iframe.style.width = '400px';
                      iframe.style.height = '600px';
                      iframe.style.border = 'none';
                      iframe.style.borderRadius = '8px';
                      iframe.style.zIndex = '10000';
                      iframe.style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)';

                      const closeBtn = document.createElement('div');
                      closeBtn.innerHTML = '×';

                      // 关闭按钮样式（格式化为多行）
                      closeBtn.style.position = 'fixed';
                      closeBtn.style.bottom = '685px';
                      closeBtn.style.right = '25px';
                      closeBtn.style.width = '20px';
                      closeBtn.style.height = '20px';
                      closeBtn.style.background = '#ff4757';
                      closeBtn.style.color = 'white';
                      closeBtn.style.borderRadius = '50%%';
                      closeBtn.style.textAlign = 'center';
                      closeBtn.style.lineHeight = '20px';
                      closeBtn.style.cursor = 'pointer';
                      closeBtn.style.zIndex = '10001';
                      closeBtn.style.fontFamily = 'sans-serif';

                      closeBtn.onclick = function() {
                        document.body.removeChild(iframe);
                        document.body.removeChild(closeBtn);
                        agentButton.style.display = 'block';
                      };

                      document.body.appendChild(iframe);
                      document.body.appendChild(closeBtn);
                      agentButton.style.display = 'none';
                    };

                    document.body.appendChild(agentButton);
                  })();
                </script>
                """, baseUrl, publicId, baseUrl, publicId);
    }

    /** 实例方法：使用配置的baseUrl生成嵌入代码 */
    public String generateEmbedCodeWithConfig(String publicId) {
        return generateEmbedCode(publicId, frontendBaseUrl);
    }

    /** 实例方法：转换为带嵌入代码的DTO */
    public AgentWidgetDTO toDTOWithEmbedCode(AgentWidgetEntity entity, ModelDTO model, ProviderDTO provider) {
        return toDTOWithEmbedCode(entity, model, provider, frontendBaseUrl);
    }
}