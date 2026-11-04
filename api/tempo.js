const axios = require("axios");
const cheerio = require("cheerio");
const {
    normalizeSpace,
    fetchHtml,
    errorResult,
    toTime,
    toTimeFromAgo,
    readJsonLd,
    collectMedia,
    DEFAULT_HEADERS,
} = require("./helpers");

const base_url = "https://www.tempo.co";
const api_base_url = "https://api.tempo.co";

// Public key exposed by tempo.co's own Nuxt application. It works as the
// X-API-Key header on api.tempo.co and is what this scraper uses to read the
// article lists without going through Cloudflare.
const API_KEY = "81463481-162f-4225-bca9-458e32ff0732";

// Tempo has no olahraga.tempo.co subdomain; sport content lives on bola.
const CATEGORY_ALIASES = {
    "": "",
    news: "",
    olahraga: "bola",
    sport: "bola",
};

function normalizeCategory(category) {
    const cat = String(category || "").toLowerCase();
    return Object.prototype.hasOwnProperty.call(CATEGORY_ALIASES, cat)
        ? CATEGORY_ALIASES[cat]
        : cat;
}

async function fetchApi(path) {
    return axios.get(api_base_url + path, {
        headers: {
            ...DEFAULT_HEADERS,
            Accept: "application/json",
            "X-API-Key": API_KEY,
        },
        timeout: 20000,
        maxRedirects: 5,
    });
}

function flattenApiPayload(payload) {
    const items = [];

    if (Array.isArray(payload)) {
        items.push(...payload);
    } else if (payload && typeof payload === "object") {
        for (const key of Object.keys(payload)) {
            const value = payload[key];
            if (Array.isArray(value)) {
                items.push(...value);
            } else if (value && typeof value === "object" && Array.isArray(value.data)) {
                items.push(...value.data);
            }
        }
    }

    return items.filter(
        (item) => item && item.id && item.judul && (item.url || item.nama_kanal || item.kanal)
    );
}

function extractFromUrl(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname;
        const path = parsed.pathname.replace(/^\/+/, "");

        let label = "www";
        if (host.endsWith(".tempo.co")) {
            label = host.split(".")[0];
        }

        const parts = path.split("/");
        // /read/2122764/slug
        if (parts[0] === "read" && parts[1]) {
            return { label: label, id: parts[1], path: path };
        }
        return { label: label, id: null, path: path };
    } catch (e) {
        return { label: "www", id: null, path: String(url || "") };
    }
}

function slugify(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/['’"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function mapApiItem(item, fallbackCategory) {
    const info = item.url ? extractFromUrl(item.url) : null;

    // /kanal/<channel> responses do not include the article URL, only
    // id/date/kanal metadata. Rebuild a canonical Tempo URL for them.
    let label = info ? info.label : null;
    if (!label) {
        const kanal = String(item.nama_kanal || item.kanal || fallbackCategory || "www").toLowerCase();
        label = kanal === "www" || kanal === "" ? "www" : kanal;
    }

    const id = info && info.id ? info.id : String(item.id);
    const slugPart = info && info.path ? info.path : `read/${id}/${slugify(item.judul)}`;
    const link =
        item.url ||
        `https://${label}.tempo.co/read/${id}/${slugify(item.judul)}`;

    return {
        title: normalizeSpace(item.judul),
        image_thumbnail: item.foto || null,
        image_full: item.foto || null,
        time: toTime(item.create_date || item.date, [
            "YYYY-MM-DD HH:mm:ss",
            "YYYY-MM-DD HH:mm",
        ]),
        link: link,
        // Detail route is /tempo/:cat/:read/:id/:slug, so the first segment
        // must be the channel used by the article URL.
        slug: `${label}/${slugPart}`,
    };
}

function cleanupItems(items) {
    const result = [];
    const seen = new Set();

    for (const item of items) {
        if (!item || seen.has(item.link)) continue;
        seen.add(item.link);
        result.push(item);
    }

    result.sort((a, b) => {
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return b.time.localeCompare(a.time);
    });

    return result;
}

async function getData(category) {
    const cat = normalizeCategory(category);

    try {
        const response = await fetchApi(cat ? `/kanal/${cat}` : "/");
        let items = flattenApiPayload(response.data);

        // Some channels (e.g. olahraga) return ["empty"]. Fall back to bola.
        if (items.length <= 0 && cat === "bola") {
            const fallback = await fetchApi("/");
            items = flattenApiPayload(fallback.data);
        }

        const mapped = items.map((item) => mapApiItem(item, cat));
        const result = cleanupItems(mapped);

        if (result.length <= 0) {
            return { error: { message: "Tidak ada berita yang bisa diparsing dari API Tempo" } };
        }

        return result;
    } catch (error) {
        return errorResult(error);
    }
}

function buildDetailUrls(category, slug) {
    const cat = String(category || "www").toLowerCase();
    const cleanSlug = String(slug || "").replace(/^\/+/, "");
    const urls = [];

    if (cat === "www" || cat === "tempo") {
        urls.push(`https://www.tempo.co/${cleanSlug}`);
    } else {
        urls.push(`https://${cat}.tempo.co/${cleanSlug}`);
    }

    // Fallback in case the channel subdomain is not the one in the URL.
    urls.push(`https://www.tempo.co/${cleanSlug}`);

    return [...new Set(urls)];
}

function parseTempoArticle($, url) {
    const title =
        normalizeSpace($("h1.title").first().text()) ||
        normalizeSpace($("h1").first().text()) ||
        normalizeSpace($('meta[property="og:title"]').attr("content"));

    let content = $(".main-left article.detail-artikel:not(.berikutnya) #isi").first();
    if (content.length <= 0) content = $("#isi").first();
    if (content.length <= 0) content = $("article.detail-artikel").first();
    if (content.length <= 0) content = $("article").first();
    if (content.length <= 0) content = $("body");

    const medias = collectMedia($, content);

    content.find("script, style, noscript").remove();
    content
        .find(".iklan, .ads, .advertisement, .bacajuga, .baca-juga, [id^='div-gpt-ad']")
        .remove();
    content.find("iframe").remove();

    const jsonLd = readJsonLd($);
    let theTime = jsonLd ? toTime(jsonLd.datePublished) : null;

    if (!theTime) {
        const timeEl = $("h4.date").first();
        const rawTime = normalizeSpace(timeEl.text()).replace(/WIB/gi, "");
        theTime =
            toTime(rawTime, [
                "dddd, D MMMM YYYY HH:mm",
                "dddd, DD MMMM YYYY HH:mm",
                "D MMMM YYYY HH:mm",
                "DD MMMM YYYY HH:mm",
            ]) || toTimeFromAgo(rawTime);
    }

    if (!theTime) {
        const timeEl = $("time[datetime]").first();
        theTime = toTime(timeEl.attr("datetime"));
    }

    const image =
        $('meta[property="og:image"]').attr("content") ||
        $(".foto-detail img").first().attr("src") ||
        null;

    return {
        original_url: url,
        title: title,
        content: normalizeSpace(content.text()),
        image: image,
        time: theTime || "-",
        media: medias,
    };
}

async function findArticleInApi(category, id) {
    if (!id) return null;

    const cat = String(category || "").toLowerCase();
    const paths = [];

    if (cat && cat !== "www" && cat !== "tempo") {
        paths.push(`/kanal/${cat}`);
    }
    paths.push("/");

    for (const path of paths) {
        try {
            const response = await fetchApi(path);
            const items = flattenApiPayload(response.data);
            const match = items.find((item) => String(item.id) === String(id));
            if (match) return match;
        } catch (e) {
            // Try the next endpoint.
        }
    }

    return null;
}

async function getDetail(category, slug) {
    const cleanSlug = String(slug || "").replace(/^\/+/, "");
    const urls = buildDetailUrls(category, cleanSlug);

    let lastError;
    for (const url of urls) {
        try {
            const response = await fetchHtml(url);
            const $ = cheerio.load(response.data);
            const result = parseTempoArticle($, url);

            if (result.title && result.content) {
                return result;
            }
        } catch (error) {
            lastError = error;
        }
    }

    // Cloudflare sometimes blocks tempo.co from data-center IPs. Fall back to
    // the API metadata so consumers still get the article summary.
    const idMatch = cleanSlug.match(/\/read\/(\d+)/) || cleanSlug.match(/(\d{5,})/);
    const id = idMatch ? idMatch[1] : null;
    const apiItem = await findArticleInApi(category, id);

    if (apiItem) {
        return {
            original_url: apiItem.url || urls[0],
            title: normalizeSpace(apiItem.judul),
            content: normalizeSpace(apiItem.deskripsi),
            image: apiItem.foto || null,
            time:
                toTime(apiItem.create_date || apiItem.date, [
                    "YYYY-MM-DD HH:mm:ss",
                    "YYYY-MM-DD HH:mm",
                ]) || "-",
            media: [],
            partial: true,
            note: "Konten lengkap tidak tersedia karena halaman Tempo diblokir; data diambil dari API.",
        };
    }

    return errorResult(lastError);
}

module.exports = {
    getData: getData,
    getDetail: getDetail,
};
