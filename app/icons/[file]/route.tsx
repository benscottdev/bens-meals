import { ImageResponse } from "next/og";

const SIZES: Record<string, number> = { "icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180, "maskable-512.png": 512 };

export function generateStaticParams() {
  return Object.keys(SIZES).map((file) => ({ file }));
}

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const size = SIZES[file] ?? 192;
  const pad = file.startsWith("maskable") ? 0.22 : 0.12;
  const inner = Math.round(size * (1 - pad * 2));
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f2ec" }}>
        <svg width={inner} height={inner} viewBox="0 0 24 24">
          <path d="M10.6 13.4 6.2 17.8" stroke="#252321" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="4.4" cy="18.2" r="1.7" fill="#252321" />
          <circle cx="5.8" cy="19.6" r="1.7" fill="#252321" />
          <ellipse cx="15" cy="9" rx="6.6" ry="5.4" transform="rotate(-45 15 9)" fill="#c9a66b" stroke="#f5f2ec" strokeWidth="0.8" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
