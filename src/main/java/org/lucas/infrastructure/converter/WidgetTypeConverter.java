package org.lucas.infrastructure.converter;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedJdbcTypes;
import org.apache.ibatis.type.MappedTypes;
import org.lucas.domain.agent.constant.WidgetType;

/** Widget类型转换器 */
@MappedJdbcTypes(JdbcType.VARCHAR)
@MappedTypes(WidgetType.class)
public class WidgetTypeConverter extends BaseTypeHandler<WidgetType> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, WidgetType parameter, JdbcType jdbcType)
            throws SQLException {
        ps.setString(i, parameter.name());
    }

    @Override
    public WidgetType getNullableResult(ResultSet rs, String columnName) throws SQLException {
        String value = rs.getString(columnName);
        return value == null ? null : WidgetType.fromCode(value);
    }

    @Override
    public WidgetType getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        String value = rs.getString(columnIndex);
        return value == null ? null : WidgetType.fromCode(value);
    }

    @Override
    public WidgetType getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        String value = cs.getString(columnIndex);
        return value == null ? null : WidgetType.fromCode(value);
    }
}