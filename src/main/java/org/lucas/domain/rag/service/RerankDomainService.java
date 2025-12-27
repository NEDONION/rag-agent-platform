package org.lucas.domain.rag.service;

import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.store.embedding.EmbeddingMatch;
import dev.langchain4j.store.embedding.EmbeddingSearchResult;
import jakarta.annotation.Resource;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.lucas.domain.rag.dto.req.RerankRequest;
import org.lucas.domain.rag.dto.resp.RerankResponse;
import org.lucas.infrastructure.rag.api.RerankForestApi;
import org.lucas.infrastructure.rag.config.RerankProperties;

/** @author shilong.zang
 * @date 16:11 <br/>
 */
@Service
public class RerankDomainService {

    @Resource
    private RerankProperties rerankProperties;

    @Resource
    private RerankForestApi rerankForestApi;

    public List<EmbeddingMatch<TextSegment>> rerankDocument(
            EmbeddingSearchResult<TextSegment> textSegmentEmbeddingSearchResult, String question) {

        List<EmbeddingMatch<TextSegment>> matches = new ArrayList<>();

        final List<String> list = textSegmentEmbeddingSearchResult.matches().stream()
                .map(text -> text.embedded().text()).toList();

        final RerankRequest rerankRequest = new RerankRequest();
        rerankRequest.setModel(rerankProperties.getModel());
        rerankRequest.setQuery(question);
        rerankRequest.setDocuments(list);

        try {
            // 使用Forest接口调用Rerank API
            final RerankResponse rerankResponse = rerankForestApi.rerank(rerankProperties.getApiUrl(),
                    rerankProperties.getApiKey(), rerankRequest);

            final List<RerankResponse.SearchResult> results = rerankResponse != null ? rerankResponse.getResults() : null;
            if (results == null || results.isEmpty()) {
                return textSegmentEmbeddingSearchResult.matches();
            }

            results.forEach(result -> {
                final Integer index = result.getIndex();
                if (index != null && index >= 0 && index < textSegmentEmbeddingSearchResult.matches().size()) {
                    matches.add(textSegmentEmbeddingSearchResult.matches().get(index));
                }
            });
            return matches.isEmpty() ? textSegmentEmbeddingSearchResult.matches() : matches;
        } catch (Exception e) {
            // Rerank失败时回退到向量检索结果，避免整体查询失败
            return textSegmentEmbeddingSearchResult.matches();
        }

        

    }

}
