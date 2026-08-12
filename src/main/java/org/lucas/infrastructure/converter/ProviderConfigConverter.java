package org.lucas.infrastructure.converter;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedJdbcTypes;
import org.apache.ibatis.type.MappedTypes;
import org.lucas.domain.llm.model.config.ProviderConfig;
import org.lucas.infrastructure.utils.ConfigCrypto;
import org.lucas.infrastructure.utils.JsonUtils;

/** 服务商配置转换器，处理加密存储的配置信息。
 *
 * <p>
 * ProviderConfig 中含用户填写的模型服务商 API Key，属于敏感数据，因此落库前加密、读取后解密。
 * 加解密实现见 {@link ConfigCrypto}。 */
@MappedTypes(ProviderConfig.class)
@MappedJdbcTypes({JdbcType.VARCHAR, JdbcType.LONGVARCHAR, JdbcType.OTHER})
public class ProviderConfigConverter extends BaseTypeHandler<ProviderConfig> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, ProviderConfig parameter, JdbcType jdbcType)
            throws SQLException {
        String jsonStr = JsonUtils.toJsonString(parameter);
        ps.setString(i, ConfigCrypto.encrypt(jsonStr));
    }

    @Override
    public ProviderConfig getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return parseEncryptedJson(rs.getString(columnName));
    }

    @Override
    public ProviderConfig getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        // 此前该重载直接返回 null，导致按列索引取值时静默拿到空配置而非报错，
        // 表现为「服务商配置突然为空」且无任何异常。现与按列名取值行为保持一致。
        return parseEncryptedJson(rs.getString(columnIndex));
    }

    @Override
    public ProviderConfig getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return parseEncryptedJson(cs.getString(columnIndex));
    }

    private ProviderConfig parseEncryptedJson(String encryptedStr) throws SQLException {
        if (encryptedStr == null || encryptedStr.isEmpty()) {
            return new ProviderConfig();
        }
        return JsonUtils.parseObject(ConfigCrypto.decrypt(encryptedStr), ProviderConfig.class);
    }
}
