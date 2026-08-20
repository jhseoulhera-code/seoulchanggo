"use client";

import { Folder, Search, Tag, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getSearchKeywordsAction, type SearchKeywordSuggestion } from "@/lib/actions/searchKeywords";
import { getSearchSuggestionsAction, type SearchSuggestion } from "@/lib/actions/searchSuggestions";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearchesServerSnapshot,
  getRecentSearchesSnapshot,
  removeRecentSearch,
  subscribeRecentSearches,
} from "@/lib/search/recentSearches";
import { normalizeSearchQuery } from "@/lib/search/normalize";
import { useMarket } from "@/contexts/MarketContext";
import { getMessages, t } from "@/messages";

const DEBOUNCE_MS = 250;

/**
 * Real search input + dropdown for the Header (STEP 12 spec sections 6-8) —
 * replaces the old plain Link-to-/search placeholder. Typing triggers
 * debounced autocomplete (lib/actions/searchSuggestions.ts); an empty,
 * focused box shows recent searches (localStorage) plus admin-curated
 * popular/recommended keywords (lib/actions/searchKeywords.ts, never a fake
 * live ranking). Submitting always lands on /search?q=... — the URL-driven
 * results page owns real filtering/sorting/pagination.
 */
export function HeaderSearchBox() {
  const router = useRouter();
  const { market } = useMarket();
  const messages = getMessages(market.locale);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const recent = useSyncExternalStore(subscribeRecentSearches, getRecentSearchesSnapshot, getRecentSearchesServerSnapshot);
  const [popular, setPopular] = useState<SearchKeywordSuggestion[]>([]);
  const [recommended, setRecommended] = useState<SearchKeywordSuggestion[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [suggestionsQuery, setSuggestionsQuery] = useState("");

  useEffect(() => {
    getSearchKeywordsAction("POPULAR").then(setPopular);
    getSearchKeywordsAction("RECOMMENDED").then(setRecommended);
  }, []);

  useEffect(() => {
    const normalized = normalizeSearchQuery(value);
    if (!normalized) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      getSearchSuggestionsAction(value).then((result) => {
        if (cancelled) return;
        setSuggestions(result);
        setSuggestionsQuery(normalized);
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function runSearch(query: string) {
    const normalized = query.trim();
    if (!normalized) return;
    addRecentSearch(normalized);
    setOpen(false);
    setValue("");
    inputRef.current?.blur();
    router.push(`/search?q=${encodeURIComponent(normalized)}`);
  }

  function handleSuggestionSelect(item: SearchSuggestion) {
    if (item.kind === "keyword") {
      runSearch(item.label);
      return;
    }
    addRecentSearch(value);
    setOpen(false);
    setValue("");
    router.push(item.href);
  }

  const trimmed = normalizeSearchQuery(value);
  const isAutocompleteMode = trimmed.length > 0;
  const hasIdleContent = recent.length > 0 || popular.length > 0 || recommended.length > 0;

  return (
    <div ref={containerRef} className="relative flex-1">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          runSearch(value);
        }}
        className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-3"
      >
        <Search size={19} className="shrink-0 text-text-secondary" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={messages.nav.searchPlaceholder}
          className="w-full bg-transparent text-[15px] text-text-main outline-none placeholder:text-text-secondary"
        />
        {value && (
          <button type="button" aria-label={messages.a11y.clearSearch} onClick={() => setValue("")} className="shrink-0 text-text-secondary">
            <X size={16} />
          </button>
        )}
      </form>

      {open && (isAutocompleteMode || hasIdleContent) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-white p-3 shadow-lg">
          {isAutocompleteMode ? (
            suggestions.length === 0 ? (
              <p className="py-6 text-center text-xs text-text-secondary">
                {suggestionsQuery !== trimmed ? messages.search.searching : messages.search.noSuggestions}
              </p>
            ) : (
              <ul className="flex flex-col">
                {suggestions.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <button
                      type="button"
                      onClick={() => handleSuggestionSelect(item)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-text-main hover:bg-surface"
                    >
                      {item.kind === "product" ? (
                        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-surface">
                          {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="36px" className="object-cover" />}
                        </span>
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text-secondary">
                          {item.kind === "category" ? <Folder size={15} /> : <Search size={15} />}
                        </span>
                      )}
                      <span className="line-clamp-1">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="flex flex-col gap-4">
              {recent.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-text-secondary">{messages.search.recentSearches}</h4>
                    <button type="button" onClick={() => clearRecentSearches()} className="text-[11px] text-text-secondary underline">
                      {messages.search.clearAll}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((term) => (
                      <span key={term} className="flex items-center gap-1 rounded-full border border-border py-1 pl-2.5 pr-1.5 text-xs text-text-main">
                        <button type="button" onClick={() => runSearch(term)}>
                          {term}
                        </button>
                        <button
                          type="button"
                          aria-label={t(messages.a11y.removeRecentSearch, { term })}
                          onClick={() => removeRecentSearch(term)}
                          className="text-text-secondary"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {popular.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-bold text-text-secondary">{messages.search.popularSearches}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {popular.map((keyword) => (
                      <button
                        key={keyword.id}
                        type="button"
                        onClick={() => runSearch(keyword.keyword)}
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-text-main"
                      >
                        {keyword.keyword}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recommended.length > 0 && (
                <div>
                  <h4 className="mb-2 flex items-center gap-1 text-xs font-bold text-text-secondary">
                    <Tag size={11} /> {messages.search.recommendedSearches}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {recommended.map((keyword) => (
                      <button
                        key={keyword.id}
                        type="button"
                        onClick={() => runSearch(keyword.keyword)}
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-text-main"
                      >
                        {keyword.keyword}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!hasIdleContent && (
                <Link href="/search" className="py-2 text-center text-xs text-text-secondary" onClick={() => setOpen(false)}>
                  {messages.search.viewAllResults}
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
