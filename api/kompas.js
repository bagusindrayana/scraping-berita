const cheerio = require("cheerio");
const {
    normalizeSpace,
    fetchHtml,
    errorResult,
    toTime,
    toTimeFromAgo,
    readJsonLd,
    collectMedia,
    absoluteUrl,
} = require("./helpers");

const base_url = "https://www.kompas.com";

const LIST_TIME_FORMATS = [
    "D MMMM YYYY HH:mm",
    "DD MMMM YYYY HH:mm",
    "D MMMM YYYY, HH:mm",
    "DD MMMM YYYY, HH:mm",
    "D MMMM YYYY",
    "DD MMMM YYYY",
    "DD/MM/YYYY HH:mm",
    "DD/MM/YYYY, HH:mm",
    "D/M/YYYY HH:mm",
    "D/M/YYYY, HH:mm",
    "DD/MM/YYYY",
    "D/M/YYYY",
];

const DETAIL_TIME_FORMATS = [
    "D MMMM YYYY, HH:mm",
    "DD MMMM YYYY, HH:mm",
    "D MMMM YYYY HH:mm",
    "DD MMMM YYYY HH:mm",
];

/**
 * Kompas homepages embed "Belt Network" promos (Kompasiana, Ohayo Jepang,
 * JEO, ...) alongside real articles. They carry a source=wp_beltnetwork
 * marker and are neither Kompas news nor guaranteed to have a timestamp.
 */
function isArticleLink(link) {
    if (!link) return false;
    try {
        const url = new URL(link, base_url);
        const host = url.hostname.toLowerCase();
        if (url.searchParams.get("source") === "wp_beltnetwork") return false;
        if (host === "kompasiana.com" || host.endsWith(".kompasiana.com")) return false;
        return url.pathname.includes("/read/");
    } catch (e) {
        return false;
    }
}

/**
 * Kompas image URLs can be resized variants. Recover the original asset.
 */
function fullImage(src) {
    if (!src) return src;
    const match = src.match(/\/data\/photo\/.+$/);
    if (match) {
        return "https://asset.kompas.com" + match[0];
    }
    return src;
}

function timeFromLink(link) {
    const match = String(link || "").match(
        /\/read\/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})(\d{2})(\d{2})/
    );
    if (!match) return null;
    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
}

function buildSlug(link) {
    if (!link) return "";
    try {
        const url = new URL(link, base_url);
        const hostParts = url.hostname.split(".");
        const path = url.pathname.replace(/^\/+/, "");

        // Links that do not use a channel subdomain.
        if (hostParts[0] === "www") {
            if (path.startsWith("read/")) {
                return "www/" + path;
            }
            // e.g. www.kompas.com/global/read/... -> global/read/...
            return path;
        }

        // e.g. nasional.kompas.com/read/... -> nasional/read/...
        return hostParts[0] + "/" + path;
    } catch (e) {
        return String(link).replace(base_url, "").replace(/^\/+/, "");
    }
}

function extractItem($, element, config) {
    const titleSelector = config.title;
    const linkSelector = config.link || config.title;

    const titleEl = titleSelector ? $(titleSelector, element).first() : $();
    const title = normalizeSpace(titleEl.text());

    const linkEl = linkSelector ? $(linkSelector, element).first() : $(element);
    const link = linkEl.attr("href") || $(element).attr("href");

    if (!title || !link) {
        return null;
    }

    let image = null;
    if (config.image) {
        const imageEl = $(config.image, element).first();
        image = imageEl.attr("data-src") || imageEl.attr("src") || null;
    }

    const rawTime = config.time
        ? normalizeSpace($(config.time, element).first().text())
              .replace(/WIB/gi, "")
              .replace(/\s+/g, " ")
              .trim()
        : "";

    const time =
        toTime(rawTime, LIST_TIME_FORMATS) ||
        toTimeFromAgo(rawTime);

    const linkTime = timeFromLink(link);
    const hasClock = /\d{1,2}[:.]\d{2}/.test(rawTime);

    return {
        title: title,
        image_thumbnail: image,
        image_full: fullImage(image),
        time: linkTime && (!time || !hasClock) ? linkTime : time,
        link: absoluteUrl(link, base_url),
        slug: buildSlug(link),
    };
}

async function fetchListing(category) {
    const cat = String(category || "").toLowerCase();

    if (!cat) {
        return fetchHtml(base_url);
    }

    const candidates = [`https://${cat}.kompas.com`, `${base_url}/${cat}`];
    let lastError;

    for (const url of candidates) {
        try {
            return await fetchHtml(url);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
}

async function getData(category) {
    try {
        const response = await fetchListing(category);
        const $ = cheerio.load(response.data);

        // Different Kompas channels still use different card layouts.
        const layouts = [
            {
                selector: ".article__list.clearfix:not(.article__list--video)",
                config: {
                    title: ".article__list__title h3 a",
                    image: ".article__list__asset .article__asset a img",
                    time: ".article__date",
                },
            },
            {
                selector: ".article__wrap__grid--flex .article__grid",
                config: {
                    title: ".article__box h3.article__title a",
                    image: ".article__asset a img",
                    time: ".article__date",
                },
            },
            {
                selector: ".trenLatest__item.clearfix",
                config: {
                    title: ".trenLatest__box h3.trenLatest__title a",
                    image: ".trenLatest__img a img",
                    time: ".tren__date",
                },
            },
            {
                selector: ".articleList .articleItem",
                config: {
                    title: ".articleTitle",
                    image: ".articleItem-img img",
                    time: ".articlePost-date",
                    link: ".article-link",
                },
            },
            {
                selector: ".wSpec-list .wSpec-item",
                config: {
                    title: ".wSpec-title",
                    image: ".wSpec-img img",
                    time: ".wSpec-subtitle span",
                    link: ".wSpec-item a",
                },
            },
        ];

        const result = [];
        const seen = new Set();

        for (const layout of layouts) {
            const elements = $(layout.selector);
            if (elements.length <= 0) continue;

            elements.each((i, element) => {
                const item = extractItem($, element, layout.config);
                if (item && isArticleLink(item.link) && !seen.has(item.link)) {
                    seen.add(item.link);
                    result.push(item);
                }
            });

            if (result.length > 0) break;
        }

        // Last resort: walk every article link on the page.
        if (result.length <= 0) {
            $('a[href*="/read/"]').each((i, element) => {
                const href = $(element).attr("href");
                if (!href) return;
                if (!isArticleLink(href)) return;

                const container = $(element).closest("div, article, li");
                const title =
                    normalizeSpace($(element).text()) ||
                    normalizeSpace(container.find("h2, h3, h4, .articleTitle").first().text()) ||
                    normalizeSpace(container.find("img").first().attr("alt"));

                if (!title) return;

                const imageEl = container.find("img").first();
                const image = imageEl.attr("data-src") || imageEl.attr("src") || null;
                const rawTime = normalizeSpace(
                    container
                        .find(".articlePost-date, .article__date, .article-date, time")
                        .first()
                        .text()
                );

                const link = absoluteUrl(href, base_url);
                if (seen.has(link)) return;
                seen.add(link);

                const linkTime = timeFromLink(href);
                const hasClock = /\d{1,2}[:.]\d{2}/.test(rawTime);
                const time =
                    (linkTime && (!hasClock) ? linkTime : null) ||
                    toTime(rawTime, LIST_TIME_FORMATS) ||
                    toTimeFromAgo(rawTime);

                result.push({
                    title: title,
                    image_thumbnail: image,
                    image_full: fullImage(image),
                    time: time,
                    link: link,
                    slug: buildSlug(href),
                });
            });
        }

        if (result.length <= 0) {
            return { error: { message: "Tidak ada berita yang bisa diparsing dari halaman Kompas" } };
        }

        return result;
    } catch (error) {
        return errorResult(error);
    }
}

async function buildDetailUrl(category, slug) {
    const cat = String(category || "www").toLowerCase();
    const cleanSlug = String(slug || "").replace(/^\/+/, "");

    if (cat === "www") {
        return `https://www.kompas.com/${cleanSlug}`;
    }

    // These channels do not have their own subdomain.
    if (cat === "global" || cat === "baca") {
        return `https://www.kompas.com/${cat}/${cleanSlug}`;
    }

    return `https://${cat}.kompas.com/${cleanSlug}`;
}

async function getDetail(category, slug) {
    const url = await buildDetailUrl(category, slug);

    try {
        const response = await fetchHtml(url);
        const $ = cheerio.load(response.data);

        const title =
            normalizeSpace($("h1.read__title").first().text()) ||
            normalizeSpace($("h1").first().text()) ||
            normalizeSpace($('meta[property="og:title"]').attr("content"));

        let content = $(".read__content").first();
        if (content.length <= 0) content = $("div[class*='read__content']").first();
        if (content.length <= 0) content = $("article").first();
        if (content.length <= 0) content = $("body");

        const medias = collectMedia($, content);

        content.find("script, style, noscript").remove();
        content
            .find(
                ".advertisement, .ads, .iklan, .baca-juga, .inner-link, .kompas-com-ads, .read__content__ads, [id^='div-gpt-ad']"
            )
            .remove();
        content.find("iframe").remove();

        const jsonLd = readJsonLd($);
        let theTime = jsonLd ? toTime(jsonLd.datePublished) : null;

        if (!theTime) {
            const timeElement = $(".read__time").first();
            const timeClone = timeElement.clone();
            timeClone.find("a").remove();
            const rawTime = normalizeSpace(timeClone.text())
                .replace(/^Kompas\.com\s*,?\s*/i, "")
                .replace(/WIB/gi, "")
                .replace(/\s+-\s+/g, " ");
            theTime = toTime(rawTime, DETAIL_TIME_FORMATS);
        }

        const image =
            $('meta[property="og:image"]').attr("content") ||
            fullImage($(".cover-photo img").first().attr("src")) ||
            null;

        return {
            original_url: url,
            title: title,
            content: normalizeSpace(content.text()),
            image: image,
            time: theTime || "-",
            media: medias,
        };
    } catch (error) {
        return errorResult(error);
    }
}

module.exports = {
    getData: getData,
    getDetail: getDetail,
};
