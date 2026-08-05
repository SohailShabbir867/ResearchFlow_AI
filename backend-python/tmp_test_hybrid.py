import src.vector_store as vs

# Stub the vector search to avoid Qdrant network calls BEFORE importing hybrid_search
vs.search = lambda query_vector, top_k=None: [{
    'text': 'Sample vector chunk text about testing hybrid search',
    'source': 'doc:sample',
    'chunk_index': 0,
    'pages': [1],
    'content_type': 'general',
    'cves': [],
    'section': '',
    'score': 0.95,
}]

import src.hybrid_search as hs

# Stub BM25 to avoid building index
hs.get_bm25_results = lambda query, top_k=30: []

res = hs.hybrid_search([0.0] * 1024, 'test query', top_k=10)
print('Hybrid search returned:', res)
