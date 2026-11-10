import { defineConfigWithTheme } from "vitepress"
import type { ThemeConfig } from "vitepress-carbon/config"
import baseConfig from "vitepress-carbon/config"
import typedocSidebar from "../api/typedoc-sidebar.json"

export default defineConfigWithTheme<ThemeConfig>({
  extends: baseConfig,
  title: "StrataDB",
  description: "Type-safe embedded document database for Bun",
  base: "/StrataDB/",

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "API", link: "/api/" },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is StrataDB?", link: "/guide/" },
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Installation", link: "/guide/installation" },
          ],
        },
        {
          text: "Core Concepts",
          items: [
            { text: "Documents", link: "/guide/documents" },
            { text: "Schemas", link: "/guide/schemas" },
            { text: "Collections", link: "/guide/collections" },
            { text: "Events", link: "/guide/events" },
            { text: "Queries", link: "/guide/queries" },
          ],
        },
        {
          text: "Advanced",
          items: [
            { text: "Architecture", link: "/DESIGN" },
            { text: "Transactions", link: "/guide/transactions" },
            { text: "Validation", link: "/guide/validation" },
            { text: "Indexes", link: "/guide/indexes" },
            {
              text: "Retries & Cancellation",
              link: "/guide/retries-and-cancellation",
            },
          ],
        },
        {
          text: "Help & Support",
          items: [
            { text: "FAQ", link: "/guide/faq" },
            { text: "Troubleshooting", link: "/guide/troubleshooting" },
            { text: "Migration", link: "/guide/migration" },
            { text: "Migrating to 0.6", link: "/guide/migrating-to-0.6" },
            {
              text: "Semantics vs MongoDB",
              link: "/guide/mongodb-differences",
            },
            { text: "Security", link: "/guide/security" },
            { text: "Testing", link: "/guide/testing" },
            { text: "Quick Reference", link: "/guide/quick-reference" },
            { text: "Performance", link: "/guide/performance" },
          ],
        },
      ],
      "/api/": typedocSidebar,
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/g5becks/StrataDB" },
    ],

    footer: {
      message: "Released under the MIT License.",
    },
  },
})
