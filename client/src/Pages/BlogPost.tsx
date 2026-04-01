import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
};

const cleanContent = (raw: string) => {
  return raw
    .replace(/\[\+\d+ chars\]$/, "")
    .replace(/\[Removed\]/gi, "")
    .trim();
};

const BlogPost = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme.toString() === "dark";

  const article = location.state?.article as NewsArticle | undefined;

  if (!article) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
        <div className="text-center px-6">
          <p className="text-5xl mb-4">😕</p>
          <p className="text-gray-900 dark:text-white font-semibold mb-2">Article not found</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            This article is no longer available. Go back to browse the latest news.
          </p>
          <button
            onClick={() => navigate("/blog")}
            className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            ← Back to Blog
          </button>
        </div>
      </div>
    );
  }

  const style = CATEGORY_STYLES[article.category] ?? CATEGORY_STYLES.all;
  const [imgError, setImgError] = useState(false);
  const content = cleanContent(article.content || article.excerpt || "");
  const isTruncated = article.content?.includes("[+") ?? false;

  return (
    <div className={`min-h-screen px-6 py-8 ${isDark ? "bg-slate-900" : "bg-slate-50"} transition-colors duration-200`}>
      <div className="max-w-2xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate("/blog")}
          className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 mb-6 transition-colors duration-200 cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to News
        </button>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${style.bg} ${style.text} capitalize`}>
            {style.emoji} {style.label}
          </span>
          {article.source && (
            <span className="text-xs text-slate-400 dark:text-slate-500">{article.source}</span>
          )}
          <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(article.publishedAt)}</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-snug mb-4">
          {article.title}
        </h1>

        {/* Author */}
        {article.author && (
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {article.author.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-300">{article.author}</span>
          </div>
        )}

        {/* Cover image */}
        {article.urlToImage && !imgError ? (
          <div className="rounded-2xl overflow-hidden mb-7">
            <img
              src={article.urlToImage}
              alt={article.title}
              onError={() => setImgError(true)}
              className="w-full object-cover max-h-72"
            />
          </div>
        ) : (
          <div className="h-44 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-2xl flex items-center justify-center text-7xl mb-7 select-none">
            {style.emoji}
          </div>
        )}

        {/* Excerpt */}
        {article.excerpt && article.excerpt !== article.content && (
          <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed mb-5 font-medium border-l-4 border-emerald-500 pl-4">
            {article.excerpt}
          </p>
        )}

        {/* Content */}
        {content && (
          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-4 mb-6">
            {content.split(/\n+/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}

        {/* Read full article CTA */}
        <div className={`rounded-2xl p-5 ${isDark ? "bg-slate-800" : "bg-white"} border border-slate-100 dark:border-slate-700`}>
          {isTruncated && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
              This preview is truncated. Read the full article on the original source.
            </p>
          )}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors duration-200"
          >
            Read Full Article
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
};

export default BlogPost;
