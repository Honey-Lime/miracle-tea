const express = require("express");
const Product = require("../models/Product");
const { getProductPath } = require("../utils/seo");

const router = express.Router();
const SITE_URL = "https://www.xn--80ahqsxxd.xn--p1ai";

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

router.get("/sitemap.xml", async (req, res, next) => {
  try {
    const products = await Product.find()
      .select("_id name updatedAt")
      .sort({ updatedAt: -1 })
      .lean();
    const urls = [
      { path: "/", changefreq: "weekly", priority: "1.0" },
      { path: "/catalog", changefreq: "daily", priority: "0.9" },
      ...products.map((product) => ({
        path: getProductPath(product),
        lastmod: product.updatedAt?.toISOString().slice(0, 10),
        changefreq: "weekly",
        priority: "0.8",
      })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ path, lastmod, changefreq, priority }) => `  <url>
    <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

    res.set({
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    });
    res.send(xml);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
