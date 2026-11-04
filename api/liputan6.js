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

const base_url = "https://www.liputan6.com";

const LIST_TIME_FORMATS = [
    "DD MMM YYYY HH:mm",
    "D MMM YYYY HH:mm",
    "DD MMMM YYYY HH:mm",
    "D MMMM YYYY HH:mm",
    "YYYY-MM-DD HH:mm:ss",
];

/**
 * Liputan6 thumbnails contain the requested crop size in the path,
 * e.g. /100x100/smart/ or /255x143/smart/.
 */
function fullImage(src) {
    if (!src) return null;
    return src.replace(/\/\d+x\d+\/smart\//, "/1200x675/smart/");
}

function buildSlug(link) {
    if (!link) return "";
    return String(link).replace(base_url, "").replace("https://m.liputan6.com", "");
}

function parseIridescentList($) {
    const result = [];
    const seen = new Set();

    $(".articles--iridescent-list article").each((i, element) => {
        const titleLink = $(
            ".articles--iridescent-list--text-item__title a",
            element
        ).first();
        const title = normalizeSpace(
            $(".articles--iridescent-list--text-item__title-link-text", element).text() ||
                titleLink.text()
        );
        const link = titleLink.attr("href");
        if (!title || !link) return;

        let imageEl = $(
            ".articles--iridescent-list--text-item__figure-image",
            element
        ).first();
        if (imageEl.length <= 0) {
            const fallbackImage = $("figure img", element).first();
            imageEl = fallbackImage;
        }
        const image = imageEl.attr("data-src") || imageEl.attr("src") || null;

        const timeEl = $("time", element).first();
        const rawTime = timeEl.attr("datetime") || normalizeSpace(
            $(".articles--iridescent-list--text-item__time", element).text()
        );
        const time =
            toTime(rawTime, LIST_TIME_FORMATS) || toTimeFromAgo(rawTime);

        if (seen.has(link)) return;
        seen.add(link);

        result.push({
            title: title,
            image_thumbnail: image,
            image_full: fullImage(image),
            time: time,
            link: link,
            slug: buildSlug(link),
        });
    });

    return result;
}

/**
 * The homepage uses a newer layout than the channel pages.
 */
function parseHomepage($) {
    const result = [];
    const seen = new Set();

    const push = (title, link, image, rawTime) => {
        title = normalizeSpace(title);
        if (!title || !link || seen.has(link)) return;
        seen.add(link);
        const time = toTime(rawTime, LIST_TIME_FORMATS) || toTimeFromAgo(rawTime);
        result.push({
            title: title,
            image_thumbnail: image || null,
            image_full: fullImage(image),
            time: time,
            link: absoluteUrl(link, base_url),
            slug: buildSlug(link),
        });
    };

    $(".headline__item").each((i, element) => {
        push(
            $(".headline__item__title", element).text(),
            $(element).attr("href"),
            $(".headline__item__image", element).attr("src") ||
                $(".headline__item__image", element).attr("data-src"),
            $("time", element).first().attr("datetime")
        );
    });

    $(".channel-highlights__item").each((i, element) => {
        const linkEl = $(".channel-highlights__link", element).first();
        push(
            $(".channel-highlights__text a", element).text() ||
                $(".channel-highlights__text", element).text(),
            linkEl.attr("href"),
            $(".channel-highlights__image", element).attr("src") ||
                $(".channel-highlights__image", element).attr("data-src"),
            $(".channel-highlights__time", element).attr("datetime")
        );
    });

    $(".special-content-inner-box-list-item").each((i, element) => {
        const linkEl = $(".special-content-inner-box-list-item-title", element).first();
        push(
            linkEl.text(),
            linkEl.attr("href"),
            $(".special-content-inner-box-list-item-figure-img", element).attr("src") ||
                $(".special-content-inner-box-list-item-figure-img", element).attr("data-src"),
            $(".special-content-inner-box-list-item-time", element).attr("datetime")
        );
    });

    return result;
}

/**
 * Final fallback that works on both layouts: follow article links and use
 * the closest container for the title/image/time.
 */
function parseGeneric($) {
    const result = [];
    const seen = new Set();

    $('a[href*="/read/"]').each((i, element) => {
        const href = $(element).attr("href");
        if (!href) return;

        const container = $(element).closest("article, li, div");
        const title =
            normalizeSpace($(element).text()) ||
            normalizeSpace(container.find("h1, h2, h3, h4").first().text()) ||
            normalizeSpace(container.find("img").first().attr("alt"));

        if (!title || seen.has(href)) return;
        seen.add(href);

        const imageEl = container.find("img").first();
        const image = imageEl.attr("data-src") || imageEl.attr("src") || null;

        const timeEl = container.find("time").first();
        const rawTime = timeEl.attr("datetime") || normalizeSpace(
            container
                .find(
                    ".articles--iridescent-list--text-item__time, .item__time, .headline__item__published, .channel-highlights__time"
                )
                .first()
                .text()
        );

        result.push({
            title: title,
            image_thumbnail: image,
            image_full: fullImage(image),
            time: toTime(rawTime, LIST_TIME_FORMATS) || toTimeFromAgo(rawTime),
            link: absoluteUrl(href, base_url),
            slug: buildSlug(href),
        });
    });

    return result;
}

async function getData(category) {
    const cat = String(category || "").toLowerCase();
    const url = cat ? `${base_url}/${cat}` : base_url;

    try {
        const response = await fetchHtml(url);
        const $ = cheerio.load(response.data);

        let result = parseIridescentList($);

        if (cat === "" && result.length <= 0) {
            result = parseHomepage($);
        }

        if (result.length <= 0) {
            result = parseGeneric($);
        }

        if (result.length <= 0) {
            return { error: { message: "Tidak ada berita yang bisa diparsing dari halaman " + url } };
        }

        return result;
    } catch (error) {
        return errorResult(error);
    }
}

async function getDetail(slug) {
    const cleanSlug = String(slug || "").replace(/^\/+/, "");
    const url = `${base_url}/${cleanSlug}`;

    try {
        const response = await fetchHtml(url);
        const $ = cheerio.load(response.data);

        const title =
            normalizeSpace($("h1").first().text()) ||
            normalizeSpace($('meta[property="og:title"]').attr("content"));

        let content = $(".article-content-body").first();
        if (content.length <= 0) content = $(".read-page-box").first();
        if (content.length <= 0) content = $("article").first();
        if (content.length <= 0) content = $("body");

        const medias = collectMedia($, content);

        content.find("script, style, noscript").remove();
        content
            .find(
                ".baca-juga-collections, .advertisement-placeholder, .advertisement-text, .ads, .iklan, [id^='div-gpt-ad']"
            )
            .remove();
        content.find("iframe").remove();

        const jsonLd = readJsonLd($);
        let theTime = jsonLd ? toTime(jsonLd.datePublished) : null;

        if (!theTime) {
            theTime = toTime(
                $('meta[property="article:published_time"]').attr("content")
            );
        }

        if (!theTime) {
            const rawTime = normalizeSpace(
                $(".read-page-box__author__updated").first().text()
            ).replace(/^Diterbitkan\s*/i, "").replace(/WIB/gi, "");
            theTime = toTime(rawTime, [
                "DD MMMM YYYY, HH:mm",
                "D MMMM YYYY, HH:mm",
                "DD MMMM YYYY HH:mm",
                "D MMMM YYYY HH:mm",
            ]);
        }

        const image =
            $('meta[property="og:image"]').attr("content") ||
            content.find("img").first().attr("src") ||
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
