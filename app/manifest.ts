import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ben's Meals",
    short_name: "Meals",
    description: "Weekly meals, recipes and the shopping list — sorted.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f2ec",
    theme_color: "#f5f2ec",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Shopping list", url: "/shop" },
      { name: "This week", url: "/plan" },
    ],
  };
}
