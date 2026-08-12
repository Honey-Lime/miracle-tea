import { useLocation } from "react-router-dom";
import { useSeo } from "./Seo";

const getPageSeo = (pathname) => {
  if (pathname.startsWith("/tea/") || pathname.startsWith("/product/")) {
    return { enabled: false };
  }

  if (pathname === "/") {
    return {
      title: "Качественный чай недорого с доставкой | Чудо чай",
      description:
        "Качественный чай недорого: китайский чай, пуэр, улун, зеленые и черные сорта. Честные цены, заказ от 50 г и доставка по Центральной России.",
    };
  }

  if (pathname === "/catalog") {
    return {
      title: "Купить качественный китайский чай недорого | Чудо чай",
      description:
        "Качественный китайский чай недорого: улуны, пуэры, зеленый и черный листовой чай. Актуальные цены, пробники и доставка по Центральной России.",
      canonicalPath: "/catalog",
    };
  }

  if (pathname === "/about") {
    return {
      title: "О компании Чудо чай | Чай из Воронежа с доставкой по России",
      description:
        "Чудо чай — молодая компания из Воронежа. Отбираем чай, который пьем сами, сохраняем честные цены и доставляем заказы по всей России.",
      canonicalPath: "/about",
    };
  }

  if (
    pathname.startsWith("/admin") ||
    [
      "/cart",
      "/checkout",
      "/profile",
      "/thank-you",
      "/personal-data-policy",
      "/refund-policy",
    ].includes(pathname)
  ) {
    return {
      title: "Чудо чай",
      description: "Интернет-магазин чая Чудо чай.",
      canonicalPath: pathname,
      noIndex: true,
    };
  }

  return {
    title: "Чудо чай | Интернет-магазин чая",
    description: "Интернет-магазин чая Чудо чай.",
    canonicalPath: pathname,
  };
};

const PageSeo = () => {
  const { pathname } = useLocation();
  useSeo(getPageSeo(pathname));
  return null;
};

export default PageSeo;
