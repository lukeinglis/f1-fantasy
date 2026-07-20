import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "F1 Fantasy League",
    short_name: "F1 Fantasy",
    description: "A use-it-or-lose-it F1 fantasy league with friends",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#1a1a2e",
    background_color: "#1a1a2e",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
