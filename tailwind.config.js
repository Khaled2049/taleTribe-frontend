import preset from "@novelsync/design-tokens/tailwind";

export default {
  presets: [preset],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./packages/reader-ui/dist/**/*.js",
  ],
};
