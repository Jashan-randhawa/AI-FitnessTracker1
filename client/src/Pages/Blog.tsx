import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../configs/api";
import { useTheme } from "../Context/Themecontext";

type NewsArticle = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  source: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  category: string;
};

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
  all:       { bg: "bg-slate-100 dark:bg-slate-700",          text: "text-slate-700 dark:text-slate-300",    label: "All",       emoji: "📰" },
  fitness:   { bg: "bg-emerald-100 dark:bg-emerald-500/20",   text: "text-emerald-700 dark:text-emerald-400", label: "Fitness",   emoji: "💪" },
  nutrition: { bg: "bg-orange-100 dark:bg-orange-500/20",     text: "text-orange-700 dark:text-orange-400",   label: "Nutrition", emoji: "🥗" },
  health:    { bg: "bg-blue-100 dark:bg-blue-500/20",         text: "text-blue-700 dark:text-blue-400",       label: "Health",    emoji: "❤️" },
  wellness:  { bg: "bg-purple-100 dark:bg-purple-500/20",     text: "text-purple-700 dark:text-purple-400",   label: "Wellness",  emoji: "🧘" },
};

const CATEGORIES = ["all", "fitness", "nutrition", "health", "wellness"];

// 3-col grid on lg, 2-col on sm → 9 fills exactly 3 rows on desktop
const PAGE_SIZE = 9;

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
};

const estimateReadTime = (text: string) => Math.max(1, Math.ceil((text || "").length / 1200));

const ArticleCard = ({ article, onClick }: { article: NewsArticle; onClick: () => void }) => {
  const cat = CATEGORY_STYLES[article.category] ?? CATEGORY_STYLES.all;
  const [imgError, setImgError] = useState(false);

  return (
    <button
      onClick={onClick}
      className="group text-left w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
    >
      {article.urlToImage && !imgError ? (
        <div className="h-40 overflow-hidden">
          <img
            src={article.urlToImage}
            alt={article.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="h-40 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-5xl select-none">
          {cat.emoji}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${cat.bg} ${cat.text} capitalize`}>
            {cat.label}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {estimateReadTime(article.excerpt + article.content)} min read
          </span>
        </div>

        <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug mb-1.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-200 line-clamp-2">
          {article.title}
        </h3>

        {article.excerpt && (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mb-3">
            {article.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between pt-2.5 border-t border-slate-50 dark:border-slate-700">
          <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[55%]">
            {article.source || article.author || "Unknown"}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
            {formatDate(article.publishedAt)}
          </span>
        </div>
      </div>
    </button>
  );
};

const SkeletonCard = () => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden animate-pulse border border-slate-100 dark:border-slate-700">
    <div className="h-40 bg-slate-100 dark:bg-slate-700" />
    <div className="p-4 space-y-3">
      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/3" />
      <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-full" />
      <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-3/4" />
      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/2" />
    </div>
  </div>
);

const Blog = () => {
  const [allArticles, setAllArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme.toString() === "dark";

  const fetchArticles = useCallback(async (category: string, q: string) => {
    try {
      setLoading(true);
      setError("");
      setPage(1);
      const params = new URLSearchParams({ category, pageSize: "40" });
      if (q) params.set("q", q);
      const res = await api.get(`/api/news/headlines?${params}`);
      setAllArticles(res.data.articles ?? []);
    } catch (err: any) {
      const rawMsg = err?.response?.data?.error;
      const msg = typeof rawMsg === "string" ? rawMsg : "";
      if (msg.includes("NEWS_API_KEY")) {
        setError("news_api_key_missing");
      } else {
        setError("Failed to load news. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles(activeCategory, search);
  }, [activeCategory, search, fetchArticles]);

  const handleSearch = () => {
    setSearch(searchInput.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setSearchInput("");
    setSearch("");
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(allArticles.length / PAGE_SIZE));
  const paginated = allArticles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const goToPage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={`min-h-screen px-6 py-8 ${isDark ? "bg-slate-900" : "bg-slate-50"} transition-colors duration-200`}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Fitness & Health News
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Live articles from across the web on fitness, nutrition, health, and wellness.
          </p>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-5">
          <div className="relative flex-1">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search articles…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-colors duration-200"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors duration-200 cursor-pointer"
          >
            Search
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-7">
          {CATEGORIES.map((cat) => {
            const style = CATEGORY_STYLES[cat];
            const isActive = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? cat === "all"
                      ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                      : `${style.bg} ${style.text} ring-2 ring-offset-1 ${isDark ? "ring-offset-slate-900" : "ring-offset-slate-50"} ring-current`
                    : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300"
                }`}
              >
                <span>{style.emoji}</span>
                {style.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error === "news_api_key_missing" ? (
          <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
            <p className="text-4xl mb-4">🔑</p>
            <p className="text-gray-900 dark:text-white font-semibold mb-2">News API key not configured</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
              Add your <strong>NEWS_API_KEY</strong> from{" "}
              <a href="https://newsapi.org" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 underline">newsapi.org</a>{" "}
              to your environment secrets.
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">😕</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{error}</p>
            <button onClick={() => fetchArticles(activeCategory, search)} className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">
              Try again
            </button>
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-900 dark:text-white font-medium mb-1">No articles found</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Try a different search term or category.</p>
          </div>
        ) : (
          <>
            {/* Results info */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {allArticles.length} article{allArticles.length !== 1 ? "s" : ""}
                {search && ` for "${search}"`}
              </p>
              {totalPages > 1 && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Page {page} of {totalPages}
                </p>
              )}
            </div>

            {/* Grid — 3 cols × 3 rows = 9 per page */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginated.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => navigate(`/blog/${encodeURIComponent(article.id)}`, { state: { article } })}
                />
              ))}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Prev
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "..." ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-sm">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => goToPage(p as number)}
                          className={`w-9 h-9 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                            p === page
                              ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                </div>

                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                >
                  Next
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Blog;
