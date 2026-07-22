import React from "react";

const SIZES = {
  sm: { outer: 28, text: "text-[10px]" },
  md: { outer: 36, text: "text-xs"    },
  lg: { outer: 48, text: "text-sm"    },
  xl: { outer: 64, text: "text-base"  },
};

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");
}

// Consistent but deterministic color per name
const GRADIENT_PAIRS = [
  ["#E21B70", "#A53860"],
  ["#7C3AED", "#4F46E5"],
  ["#059669", "#0D9488"],
  ["#D97706", "#B45309"],
  ["#2563EB", "#1D4ED8"],
  ["#DC2626", "#991B1B"],
  ["#0891B2", "#0E7490"],
  ["#7C3AED", "#9333EA"],
];

function nameToColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return GRADIENT_PAIRS[Math.abs(hash) % GRADIENT_PAIRS.length];
}

export default function Avatar({ name = "", size = "md", src }) {
  const { outer, text } = SIZES[size] || SIZES.md;
  const initials = getInitials(name);
  const [from, to] = nameToColor(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="rounded-full object-cover shrink-0"
        style={{ width: outer, height: outer }}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white shrink-0 ${text}`}
      style={{
        width: outer,
        height: outer,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        boxShadow: `0 2px 8px ${from}40`,
      }}
      title={name}
    >
      {initials || "?"}
    </div>
  );
}
