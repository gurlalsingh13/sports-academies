"""
Orchestrates the entire candidate discovery phase.

Runs every configured search strategy, deduplicates results by URL, classifies
each URL by source type (government, university, corporate, etc.), and returns a
flat list of ScholarshipCandidate objects ready for crawling.
"""

from typing import List, Set

from .candidate import ScholarshipCandidate
from .strategies import DISCOVERY_STRATEGIES
from .source_classifier import SourceClassifier
from .candidate_classifier import CandidateClassifier
from .search_provider import SearchProvider


class DiscoveryEngine:

    def __init__(
        self,
        search_provider: SearchProvider,
        source_classifier: SourceClassifier,
        candidate_classifier: CandidateClassifier,
    ):
        self.search_provider = search_provider
        self.source_classifier = source_classifier
        self.candidate_classifier = candidate_classifier

    def discover(self, location: str = "Delhi") -> List[ScholarshipCandidate]:
        import time
        from .strategies import get_discovery_strategies

        candidates: List[ScholarshipCandidate] = []
        seen_urls: Set[str] = set()

        strategies = get_discovery_strategies(location)
        total_queries = sum(len(s.queries) for s in strategies)
        print(f"[DiscoveryEngine] Starting discovery for '{location}' with {total_queries} queries across {len(strategies)} strategies.")

        queries_processed = 0
        for strategy in strategies:
            for query in strategy.queries:
                queries_processed += 1
                print(f"[DiscoveryEngine] Query {queries_processed}/{total_queries}: {query}")
                results = self.search_provider.search(query)
                time.sleep(1.0)  # Rate limit pause for web search engine

                new_from_query = 0
                for result in results:
                    url = result.get("url")
                    if not url:
                        continue

                    normalized_url = self._normalize_url(url)
                    if normalized_url in seen_urls:
                        continue

                    seen_urls.add(normalized_url)

                    source_type = self.source_classifier.classify(normalized_url)
                    candidate_type = self.candidate_classifier.classify(
                        title=result.get("title", ""),
                        snippet=result.get("snippet"),
                        url=normalized_url,
                        source_type=source_type,
                    )

                    candidate = ScholarshipCandidate(
                        title=result.get("title", ""),
                        url=normalized_url,
                        snippet=result.get("snippet"),
                        discovery_query=query,
                        discovered_from="web_search",
                        source_type=source_type,
                        domain=self._extract_domain(normalized_url),
                        candidate_type=candidate_type,
                        is_official_source=None,
                    )

                    candidates.append(candidate)
                    new_from_query += 1

                print(f"[DiscoveryEngine] Found {new_from_query} new candidates from this query.")

        print(f"[DiscoveryEngine] Discovery complete. Total unique candidates: {len(candidates)}")
        return candidates

    @staticmethod
    def _normalize_url(url: str) -> str:
        return url.strip().rstrip("/")

    @staticmethod
    def _extract_domain(url: str) -> str:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain