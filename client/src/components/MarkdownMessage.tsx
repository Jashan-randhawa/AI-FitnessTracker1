import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { CollapsiblePlanCard } from "./animations/CollapsiblePlanCard";

export interface MarkdownMessageProps {
  content: string;
  className?: string;
  /** Optional rollback switch to legacy line-based renderer if desired */
  useLegacy?: boolean;
}

// Helper to identify if a heading represents a structured multi-day/week plan or workout routine
export const isPlanHeader = (title: string): boolean => {
  const clean = title.replace(/[:*#]/g, "").trim();
  return /^\s*(?:\d+[- ]*(?:day|week|month)|weekly|daily|full|custom)?\s*(?:workout|meal|exercise|training|nutrition)\s*(?:plan|routine|schedule|breakdown|program)/i.test(
    clean
  );
};

/**
 * Fenced Code Block component with syntax bar and copy-to-clipboard button
 */
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="my-3 rounded-xl border border-slate-700/80 bg-slate-900 overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-950/70 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
        <span className="uppercase tracking-wider">{language || "code"}</span>
        <button
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 sm:p-3.5 overflow-x-auto text-xs sm:text-sm font-mono text-slate-200 leading-relaxed touch-pan-x [webkit-overflow-scrolling:touch]">
        <pre className="m-0">{code}</pre>
      </div>
    </div>
  );
};

/**
 * Custom Markdown Components adhering to Section 5.2/5.3 Design System
 */
const markdownComponents = {
  h1({ children }: any) {
    return (
      <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mt-4 mb-2 pb-1 border-b border-slate-200 dark:border-slate-800">
        {children}
      </h1>
    );
  },
  h2({ children }: any) {
    return (
      <h2 className="text-[17px] font-bold text-gray-900 dark:text-white mt-4 mb-1.5 leading-snug">
        {children}
      </h2>
    );
  },
  h3({ children }: any) {
    return (
      <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mt-3.5 mb-1 leading-snug">
        {children}
      </h3>
    );
  },
  h4({ children }: any) {
    return (
      <h4 className="text-[14px] font-bold text-gray-900 dark:text-white mt-2.5 mb-1 leading-snug">
        {children}
      </h4>
    );
  },
  p({ children }: any) {
    return (
      <p className="my-1.5 text-[15px] sm:text-[16px] leading-[1.65] text-slate-800 dark:text-slate-200">
        {children}
      </p>
    );
  },
  ul({ children }: any) {
    return (
      <ul className="list-disc pl-5 my-2 space-y-1.5 text-[15px] sm:text-[16px] leading-[1.65] marker:text-emerald-500 text-slate-800 dark:text-slate-200">
        {children}
      </ul>
    );
  },
  ol({ children, start }: any) {
    return (
      <ol
        start={start}
        className="list-decimal pl-5 my-2 space-y-1.5 text-[15px] sm:text-[16px] leading-[1.65] marker:text-emerald-500 text-slate-800 dark:text-slate-200"
      >
        {children}
      </ol>
    );
  },
  li({ children }: any) {
    return <li className="pl-0.5">{children}</li>;
  },
  blockquote({ children }: any) {
    return (
      <blockquote className="my-2.5 pl-3.5 border-l-3 border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 py-1.5 text-[14px] sm:text-[15px] text-emerald-950 dark:text-emerald-200 rounded-r-lg">
        {children}
      </blockquote>
    );
  },
  hr() {
    return <hr className="my-4 border-t border-slate-200 dark:border-slate-800" />;
  },
  a({ href, children }: any) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-600 dark:text-emerald-400 font-medium underline underline-offset-2 hover:text-emerald-500 transition-colors"
      >
        {children}
      </a>
    );
  },
  table({ children }: any) {
    return (
      <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs max-w-full touch-pan-x [webkit-overflow-scrolling:touch]">
        <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[280px] sm:min-w-[340px]">
          {children}
        </table>
      </div>
    );
  },
  thead({ children }: any) {
    return (
      <thead className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 font-semibold sticky top-0 border-b border-slate-200 dark:border-slate-700">
        {children}
      </thead>
    );
  },
  tbody({ children }: any) {
    return <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>;
  },
  tr({ children }: any) {
    return (
      <tr className="odd:bg-white even:bg-slate-50/70 dark:odd:bg-slate-900/40 dark:even:bg-slate-800/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-colors">
        {children}
      </tr>
    );
  },
  th({ children, align }: any) {
    const alignClass =
      align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
    return (
      <th
        className={`px-3 sm:px-4 py-2 sm:py-2.5 text-[13px] sm:text-[14px] font-semibold text-slate-900 dark:text-white ${alignClass}`}
      >
        {children}
      </th>
    );
  },
  td({ children, align }: any) {
    const alignClass =
      align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
    return (
      <td
        className={`px-3 sm:px-4 py-2 sm:py-2.5 text-[13px] sm:text-[14px] text-slate-700 dark:text-slate-300 ${alignClass}`}
      >
        {children}
      </td>
    );
  },
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    const codeContent = String(children).replace(/\n$/, "");
    if (!inline && (match || codeContent.includes("\n"))) {
      return <CodeBlock language={match?.[1] || "text"} code={codeContent} />;
    }
    return (
      <code
        className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-mono text-xs sm:text-sm border border-slate-200/60 dark:border-slate-700/60 font-medium"
        {...props}
      >
        {children}
      </code>
    );
  },
};

/**
 * Splits text into segments around plan card headers so that
 * closing tips and post-plan paragraphs remain visible OUTSIDE the card (Finding T5).
 */
interface TextSegment {
  type: "text" | "plan";
  planTitle?: string;
  markdown: string;
}

const parsePlanSegments = (markdown: string): TextSegment[] => {
  const lines = markdown.split("\n");
  const segments: TextSegment[] = [];

  let currentText: string[] = [];
  let inPlan = false;
  let planTitle = "";
  let planHeadingLevel = 2;
  let planLines: string[] = [];

  const flushText = () => {
    if (currentText.length > 0) {
      segments.push({ type: "text", markdown: currentText.join("\n") });
      currentText = [];
    }
  };

  const flushPlan = () => {
    if (inPlan) {
      segments.push({
        type: "plan",
        planTitle,
        markdown: planLines.join("\n"),
      });
      inPlan = false;
      planTitle = "";
      planLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();

      if (!inPlan) {
        if (isPlanHeader(title)) {
          flushText();
          inPlan = true;
          planTitle = title.replace(/[:*#]/g, "").trim();
          planHeadingLevel = level;
          continue; // Header is consumed as the card's title
        }
      } else {
        // In plan: if heading is equal or higher level (e.g. ## -> ## or #), plan ends!
        if (level <= planHeadingLevel || isPlanHeader(title)) {
          flushPlan();
          if (isPlanHeader(title)) {
            inPlan = true;
            planTitle = title.replace(/[:*#]/g, "").trim();
            planHeadingLevel = level;
            continue;
          }
        }
      }
    } else if (inPlan && /^---+\s*$/.test(line.trim())) {
      // Horizontal rule also terminates a plan card
      flushPlan();
      currentText.push(line);
      continue;
    }

    if (inPlan) {
      planLines.push(line);
    } else {
      currentText.push(line);
    }
  }

  flushText();
  flushPlan();

  return segments;
};

/**
 * Standard Markdown message renderer for FitBot answers and AI responses.
 * Renders standard GFM with tables, lists, code fences, and collapsible plan cards.
 */
export const MarkdownMessage: React.FC<MarkdownMessageProps> = React.memo(
  ({ content, className = "" }) => {
    const segments = parsePlanSegments(content);

    return (
      <div className={`markdown-message max-w-prose space-y-2 text-ink dark:text-slate-100 ${className}`}>
        {segments.map((seg, idx) => {
          if (seg.type === "plan") {
            return (
              <CollapsiblePlanCard
                key={`plan-${idx}`}
                title={seg.planTitle || "Workout & Nutrition Plan"}
                badge="FitBot Plan"
                defaultOpen={true}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {seg.markdown}
                </ReactMarkdown>
              </CollapsiblePlanCard>
            );
          }

          return (
            <ReactMarkdown key={`text-${idx}`} remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {seg.markdown}
            </ReactMarkdown>
          );
        })}
      </div>
    );
  }
);

MarkdownMessage.displayName = "MarkdownMessage";

export default MarkdownMessage;
