import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Agenda · Casale del Notaio",
    short_name: "Agenda Casale",
    description: "Agenda digitale dei banchetti del Casale del Notaio.",
    id: "/agenda",
    start_url: "/agenda",
    scope: "/",
    display: "standalone",
    background_color: "#1C2B2D",
    theme_color: "#1C2B2D",
    lang: "it",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
