const cheerio = require("cheerio");
const {
    normalizeSpace,
    fetchHtml,
    errorResult,
    toTime,
    toTimeFromAgo,
    readJsonLd,
    collectMedia,
} = require("./helpers");

const base_url = "https://www.tribunnews.com";
const mobile_base_url = "https://m.tribunnews.com";

/**
 * Tribunnews serves resized thumbnails through an asset proxy.
 * Rebuild the original image URL from the path after "/tribunnews/foto/".
 */
function fullImage(src) {
    if (!src) return "";
    const marker = "/tribunnews/foto/";
    const index = src.indexOf(marker);
    if (index !== -1) {
        return "https://asset.tribunnews.com" + src.slice(index);
    }
    return src.replace("thumbnails2", "images");
}

function parseListItem($, element) {
    const titleLink = $("div.mr140 h3 a", element).first().length
        ? $("div.mr140 h3 a", element).first()
        : $("h3 a", element).first();

    const title = normalizeSpace(titleLink.text());
    const link = titleLink.attr("href");

    if (!title || !link) {
        return null;
    }

    const image =
        $("div.fr img", element).first().attr("src") ||
        $("img", element).first().attr("src") ||
        null;

    const timeEl = $("time", element).first();
    const rawTime =
        timeEl.attr("datetime") ||
        timeEl.attr("title") ||
        normalizeSpace(timeEl.text());

    const time =
        toTime(rawTime, ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm"]) ||
        toTimeFromAgo(rawTime);

    return {
        title: title,
        image_thumbnail: image,
        image_full: fullImage(image),
        time: time,
        link: link,
        slug: link.replace(base_url, ""),
    };
}

async function getData(category) {
    const cat = String(category || "news").toLowerCase();
    const url = `${base_url}/${cat}`;

    try {
        const response = await fetchHtml(url);
        const $ = cheerio.load(response.data);

        // Current markup uses div.listicle, older archives used li.art-list.
        let items = $("div.listicle");
        if (items.length <= 0) items = $("li.art-list.pos_rel");
        if (items.length <= 0) items = $("div.p1520.pos_rel.bdr");
        if (items.length <= 0) items = $("div.p1520.pos_rel");

        const result = [];
        const seen = new Set();

        items.each((i, element) => {
            const item = parseListItem($, element);
            if (item && !seen.has(item.link)) {
                seen.add(item.link);
                result.push(item);
            }
        });

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
    // Desktop first because it exposes a slightly cleaner article container,
    // mobile as a fallback.
    const urls = [
        `${base_url}/${cleanSlug}?page=all`,
        `${mobile_base_url}/${cleanSlug}?page=all`,
    ];

    let lastError;
    for (const url of urls) {
        try {
            const response = await fetchHtml(url);
            const $ = cheerio.load(response.data);

            const articleRoot = $("#article").length ? $("#article") : $("body");
            const title =
                normalizeSpace(articleRoot.find("h1").first().text()) ||
                normalizeSpace($('meta[property="og:title"]').attr("content"));

            let content = articleRoot.find("div.txt-article").first();
            if (content.length <= 0) content = articleRoot.find("article").first();
            if (content.length <= 0) content = articleRoot;

            const medias = collectMedia($, content);

            content.find("script, style, noscript").remove();
            content
                .find(".embed, .ads, .iklan, .advertisement, .advertisement-placeholder, [id^='div-gpt-ad']")
                .remove();
            content.find("iframe").remove();

            const jsonLd = readJsonLd($);
            let theTime = jsonLd ? toTime(jsonLd.datePublished) : null;

            if (!theTime) {
                const timeEl = articleRoot.find("time").first();
                theTime =
                    toTime(timeEl.attr("datetime") || timeEl.attr("title")) ||
                    toTime(timeEl.text(), [
                        "dddd, D MMMM YYYY HH:mm",
                        "dddd, DD MMMM YYYY HH:mm",
                        "dddd, D MMMM YYYY",
                        "D MMMM YYYY HH:mm",
                    ]) ||
                    toTimeFromAgo(timeEl.text());
            }

            const image =
                $('meta[property="og:image"]').attr("content") ||
                articleRoot.find("a.glightbox img").first().attr("src") ||
                articleRoot.find("img.wfull").first().attr("src") ||
                null;

            return {
                title: title,
                content: normalizeSpace(content.text()),
                image: image,
                time: theTime || "-",
                media: medias,
            };
        } catch (error) {
            lastError = error;
        }
    }

    return errorResult(lastError);
}

module.exports = {
    getData: getData,
    getDetail: getDetail,
};
