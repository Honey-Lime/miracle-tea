import { useEffect } from "react";

export const SITE_URL = "https://www.xn--80ahqsxxd.xn--p1ai";

const removeManagedTags = () => {
  document.head
    .querySelectorAll("[data-seo-managed]")
    .forEach((element) => element.remove());
};

const appendTag = (tagName, attributes, content) => {
  const element = document.createElement(tagName);
  element.dataset.seoManaged = "true";

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });

  if (content) {
    element.textContent = content;
  }

  document.head.appendChild(element);
};

export const getAbsoluteUrl = (path) =>
  path?.startsWith("http") ? path : `${SITE_URL}${path || "/"}`;

export const useSeo = ({
  title,
  description,
  canonicalPath = "/",
  noIndex = false,
  image,
  jsonLd,
  enabled = true,
}) => {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const canonicalUrl = getAbsoluteUrl(canonicalPath);
    document.title = title;
    removeManagedTags();

    appendTag("meta", { name: "description", content: description });
    appendTag("meta", {
      name: "robots",
      content: noIndex ? "noindex, nofollow" : "index, follow",
    });
    appendTag("link", { rel: "canonical", href: canonicalUrl });
    appendTag("meta", { property: "og:type", content: "website" });
    appendTag("meta", { property: "og:title", content: title });
    appendTag("meta", { property: "og:description", content: description });
    appendTag("meta", { property: "og:url", content: canonicalUrl });

    if (image) {
      appendTag("meta", { property: "og:image", content: getAbsoluteUrl(image) });
    }

    if (jsonLd) {
      appendTag(
        "script",
        { type: "application/ld+json" },
        JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      );
    }

    return removeManagedTags;
  }, [title, description, canonicalPath, noIndex, image, jsonLd, enabled]);
};
