import { defineConfig } from "vite";
import kontra from "rollup-plugin-kontra";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];

export default defineConfig({
  base: process.env.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}/` : "/",
  server: {
    port: 3000,
  },
  plugins: [
    kontra({
      gameObject: {
        group: true,
        ttl: true, // TODO: Figure out exactly what this is needed for
        velocity: true,
      },
      vector: {
        angle: true,
        distance: true,
        normalize: true,
        scale: true,
        subtract: true,
      },
    }),
  ],
});
