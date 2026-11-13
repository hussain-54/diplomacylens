import { useEffect, useState } from "react";
import { Check, Facebook, Link2, Linkedin, Mail, Share2, Twitter } from "lucide-react";
import { cn } from "@/lib/utils";

type IconProps = { className?: string };

// lucide-react does not ship these brand marks, so they are inlined.
function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15s-.77.96-.94 1.16c-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.85 9.85 0 0 0 12.04 2zm0 18.06h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.39c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24z" />
    </svg>
  );
}

function TelegramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M21.94 4.6 18.9 19.2c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.16c-.25.25-.46.46-.94.46l.33-4.73 8.6-7.77c.37-.33-.08-.52-.58-.19l-10.63 6.7-4.58-1.43c-1-.31-1.02-1 .21-1.48l17.9-6.9c.83-.3 1.56.2 1.29 1.22z" />
    </svg>
  );
}

function RedditIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M22 12.07c0-1.2-.98-2.18-2.18-2.18-.58 0-1.11.23-1.5.6-1.48-1.02-3.5-1.68-5.74-1.76l1.17-3.7 3.16.75a1.75 1.75 0 1 0 .2-1.2l-3.6-.85a.6.6 0 0 0-.71.4l-1.4 4.6c-2.27.06-4.32.72-5.82 1.76a2.18 2.18 0 1 0-2.4 3.55c-.03.2-.05.4-.05.61 0 3.13 3.72 5.67 8.3 5.67s8.3-2.54 8.3-5.67c0-.2-.02-.4-.05-.6.7-.36 1.12-1.06 1.12-1.98zM7.5 13.6a1.35 1.35 0 1 1 2.7 0 1.35 1.35 0 0 1-2.7 0zm7.83 3.86c-.86.86-2.5.93-3.33.93-.83 0-2.47-.07-3.33-.93a.4.4 0 0 1 .57-.57c.54.55 1.7.74 2.76.74s2.22-.19 2.76-.74a.4.4 0 1 1 .57.57zm-.53-2.5a1.35 1.35 0 1 1 0-2.71 1.35 1.35 0 0 1 0 2.7z" />
    </svg>
  );
}

/**
 * Social share row. `compact` shows icon-only buttons for the article byline,
 * `full` shows a labelled bar for the end of the story.
 */
export function ShareButtons({
  title,
  url,
  summary,
  variant = "compact",
}: {
  title: string;
  url: string;
  summary?: string | null;
  variant?: "compact" | "full";
}) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedSummary = encodeURIComponent(summary?.trim() || title);

  const targets = [
    {
      key: "x",
      label: "X",
      title: "Share on X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      icon: Twitter,
    },
    {
      key: "facebook",
      label: "Facebook",
      title: "Share on Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: Facebook,
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      title: "Share on LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: Linkedin,
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      title: "Share on WhatsApp",
      href: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
      icon: WhatsAppIcon,
    },
    {
      key: "telegram",
      label: "Telegram",
      title: "Share on Telegram",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      icon: TelegramIcon,
    },
    {
      key: "reddit",
      label: "Reddit",
      title: "Share on Reddit",
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
      icon: RedditIcon,
    },
    {
      key: "email",
      label: "Email",
      title: "Share by email",
      href: `mailto:?subject=${encodedTitle}&body=${encodedSummary}%0A%0A${encodedUrl}`,
      icon: Mail,
    },
  ];

  const copyLink = () => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const nativeShare = () => {
    void navigator.share({ title, text: summary?.trim() || title, url }).catch(() => {
      // Dismissing the OS share sheet rejects; nothing to report.
    });
  };

  const isFull = variant === "full";
  const itemClass = cn(
    "flex items-center justify-center border border-border text-muted-foreground transition-colors hover:border-crimson hover:text-crimson",
    isFull ? "h-10 gap-2 px-3 text-xs font-semibold uppercase tracking-wide" : "h-8 w-8",
  );

  return (
    <div className={cn("flex flex-wrap items-center", isFull ? "gap-2" : "gap-1.5")}>
      {targets.map(({ key, label, title: linkTitle, href, icon: Icon }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={linkTitle}
          title={linkTitle}
          className={itemClass}
        >
          <Icon className="h-4 w-4" />
          {isFull && <span>{label}</span>}
        </a>
      ))}
      <button
        type="button"
        aria-label="Copy link"
        title={copied ? "Link copied" : "Copy link"}
        onClick={copyLink}
        className={itemClass}
      >
        {copied ? <Check className="h-4 w-4 text-cat-green" /> : <Link2 className="h-4 w-4" />}
        {isFull && <span>{copied ? "Copied" : "Copy link"}</span>}
      </button>
      {canNativeShare && (
        <button
          type="button"
          aria-label="Share"
          title="Share"
          onClick={nativeShare}
          className={itemClass}
        >
          <Share2 className="h-4 w-4" />
          {isFull && <span>More</span>}
        </button>
      )}
    </div>
  );
}
