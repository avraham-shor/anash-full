import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src",
  ssr: false, // Set to false for a Single Page App (SPA)
  future: {
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
} satisfies Config;
