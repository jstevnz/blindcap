import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const storageOrigin = storageUrl ? new URL(storageUrl).origin : "";
    const imageSources = ["'self'", "data:"];
    if (storageOrigin) {
      imageSources.push(
        `${storageOrigin}/storage/v1/object/sign/blindcap-avatars/`,
        `${storageOrigin}/storage/v1/object/sign/blindcap-series-logos/`,
      );
    }

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline'",
                "style-src 'self' 'unsafe-inline'",
                `img-src ${imageSources.join(" ")}`,
                "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
              ].join("; "),
          },
        ],
      },
    ];
  },
};
export default config;
