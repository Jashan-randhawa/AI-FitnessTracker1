import { useMemo } from "react";
import { motion } from "framer-motion";

interface StreamingWordRevealProps {
  text: string;
  className?: string;
  staggerDelay?: number;
}

const containerVariants = (staggerDelay: number) => ({
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
    },
  },
});

const wordVariants = {
  hidden: { opacity: 0, y: 4 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export const StreamingWordReveal = ({
  text,
  className = "text-sm leading-relaxed",
  staggerDelay = 0.025,
}: StreamingWordRevealProps) => {
  const paragraphs = useMemo(() => text.split("\n"), [text]);

  const variants = useMemo(() => containerVariants(staggerDelay), [staggerDelay]);

  // Formats inline bold/italic
  const renderInline = (word: string, key: string | number) => {
    if (word.startsWith("**") && word.endsWith("**") && word.length > 4) {
      return (
        <strong key={key} className="font-semibold text-gray-900 dark:text-white">
          {word.slice(2, -2)}
        </strong>
      );
    }
    if (word.startsWith("*") && word.endsWith("*") && word.length > 2) {
      return <em key={key}>{word.slice(1, -1)}</em>;
    }
    return word;
  };

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="show"
      className={className}
    >
      {paragraphs.map((p, pIdx) => {
        const trimmed = p.trim();
        if (!trimmed) return <div key={pIdx} className="h-2" />;

        const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("• ");
        const content = isBullet ? trimmed.replace(/^[-•]\s+/, "") : trimmed;
        const words = content.split(/\s+/);

        return (
          <p key={pIdx} className={`my-1.5 flex flex-wrap items-baseline gap-x-1 ${isBullet ? "pl-4" : ""}`}>
            {isBullet && (
              <motion.span
                variants={wordVariants}
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block self-center shrink-0"
              />
            )}
            {words.map((word, wIdx) => (
              <motion.span
                key={`${pIdx}-${wIdx}`}
                variants={wordVariants}
                className="inline-block"
              >
                {renderInline(word, `${pIdx}-${wIdx}`)}
              </motion.span>
            ))}
          </p>
        );
      })}
    </motion.div>
  );
};

export default StreamingWordReveal;
