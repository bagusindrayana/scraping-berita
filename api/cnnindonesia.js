const cheerio = require("cheerio");
const {
    normalizeSpace,
    fetchHtml,
    errorResult,
    toTime,
    readJsonLd,
    collectMedia,
    expandMonth,
} = require("./helpers");

const base_url = "https://www.cnnindonesia.com";

function resizeImage(src) {
    if (!src) return null;
    try {
        const url = new URL(src);
        url.searchParams.set("w", "1024");
        url.searchParams.set("q", "100");
        return url.toString();
    } catch (e) {
        return src;
    }
}

function parseListItem($, element) {
    const tagA = $("a.flex", element).first();
    const title = normalizeSpace(tagA.attr("dtr-ttl") || tagA.text());
    const link = tagA.attr("href");

    if (!title || !link) {
        return null;
    }

    const imageThumbnail = $("img", tagA).first().attr("src") || null;

    // CNN article URLs embed the publish timestamp:
    // /nasional/20261104201643-12-1423405/slug
    const idMatch = link.match(/\/(\d{14})-\d+-\d+\//);
    const time = idMatch ? toTime(idMatch[1], "YYYYMMDDHHmmss") : null;

    return {
        title: title,
        image_thumbnail: imageThumbnail,
        image_full: resizeImage(imageThumbnail),
        time: time,
        link: link,
        slug: link.replace(base_url, ""),
    };
}

async function getData(category) {
    const cat = String(category || "").toLowerCase();
    const url = cat ? `${base_url}/${cat}` : base_url;

    try {
        const response = await fetchHtml(url);
        const $ = cheerio.load(response.data);

        let items = $("div.nhl-list article.flex-grow");
        if (items.length <= 0) items = $("article.flex-grow");
        if (items.length <= 0) items = $(".nhl-list article");

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
    const url = `${base_url}/${cleanSlug}?page=all`;

    try {
        const response = await fetchHtml(url);
        const $ = cheerio.load(response.data);

        const title =
            normalizeSpace($("h1").first().text()) ||
            normalizeSpace($('meta[property="og:title"]').attr("content"));

        let content = $(".detail-text").first();
        if (content.length <= 0) content = $(".detail-wrap").first();
        if (content.length <= 0) content = $(".detail__body").first();
        if (content.length <= 0) content = $("body");

        const medias = collectMedia($, content).filter(
            (media) => !/\/icon-[^/]+\.(webp|png|svg)/i.test(media.url || "")
        );

        // CNN photo articles keep their gallery outside .detail-text.
        const seenMedia = new Set(medias.map((media) => `${media.type}|${media.url}`));
        $(".galery-foto-slider-thumb-swiper img").each((i, el) => {
            const src = $(el).attr("data-src") || $(el).attr("src");
            if (!src || /\/icon-[^/]+\./i.test(src)) return;
            const url = resizeImage(src) || src;
            const key = "image|" + url;
            if (seenMedia.has(key)) return;
            seenMedia.add(key);
            medias.push({ type: "image", url: url });
        });

        content.find("script, style, noscript").remove();
        content
            .find(
                ".daftar-isi, .paradetail, .detail_ads, .linksisip, .topiksisip, .end-of-article, " +
                    ".sisip_embed_sosmed, .skybanner, .share-bottom-new, .embed.videocnn, " +
                    ".advertisement, [id^='div-gpt-ad']"
            )
            .remove();
        content.find("iframe").remove();

        const jsonLd = readJsonLd($);
        let theTime = jsonLd ? toTime(jsonLd.datePublished) : null;

        if (!theTime) {
            const rawTime = normalizeSpace(
                $("div.text-cnn_grey.text-sm.mb-4").first().text()
            ).replace(/WIB/gi, "");
            const expanded = expandMonth(rawTime);
            theTime = toTime(expanded, [
                "dddd, DD MMMM YYYY HH:mm",
                "dddd, D MMMM YYYY HH:mm",
                "DD MMMM YYYY HH:mm",
                "D MMMM YYYY HH:mm",
            ]);
        }

        const image =
            $('meta[property="og:image"]').attr("content") ||
            $(".detail-image.my-5 img").first().attr("src") ||
            $(".detail-image img").first().attr("src") ||
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
