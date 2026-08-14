package org.lucas.infrastructure.rag.detector;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import org.apache.tika.Tika;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** @author shilong.zang
 * @date 11:32 <br/>
 */
public class TikaFileTypeDetector {

    private static final Logger logger = LoggerFactory.getLogger(TikaFileTypeDetector.class);

    public static String detectFileType(byte[] data) {
        if (data == null || data.length == 0) {
            return "未知类型";
        }

        try {
            Tika tika = new Tika();
            return tika.detect(new ByteArrayInputStream(data));
        } catch (IOException e) {
            logger.warn("Tika 文件类型识别失败，回退为未知类型: {}", e.getMessage(), e);
            return "未知类型";
        }
    }

}
