const axios = require("axios");
const moment = require("moment");
require("moment/locale/id");

moment.locale("id");

const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Upgrade-Insecure-Requests": "1",
};

const DEFAULT_TIMEOUT = 20000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSpace(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

/**
 * Fetch a page with browser-like headers and a small retry loop.
 * Returns the axios response object.
 */
async function fetchHtml(url, options = {}) {
    const {
        headers = {},
        timeout = DEFAULT_TIMEOUT,
        retries = 2,
        responseType = "text",
    } = options;

    let referer = "";
    try {
        referer = new URL(url).origin + "/";
    } catch (e) {
        referer = "";
    }

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await axios.get(url, {
                headers: {
                    ...DEFAULT_HEADERS,
                    ...(referer ? { Referer: referer } : {}),
                    ...headers,
                },
                timeout,
                responseType,
                maxRedirects: 5,
            });
        } catch (error) {
            lastError = error;
            const status = error.response && error.response.status;
            // No point retrying a genuine "not found" response.
            if (status === 404 || status === 410) {
                break;
            }
            if (attempt < retries) {
                await sleep(700 * (attempt + 1));
            }
        }
    }
    throw lastError;
}

/**
 * Convert an error into a JSON friendly object so API consumers can see
 * what actually went wrong (JSON.stringify(Error) would return "{}").
 */
function errorResult(error) {
    if (!error) {
        return { error: { message: "Unknown error" } };
    }
    return {
        error: {
            message: error.message || String(error),
            status: error.response ? error.response.status : null,
            code: error.code || null,
        },
    };
}

/**
 * Parse a date/time from many possible formats.
 * Always returns "YYYY-MM-DD HH:mm" or null.
 */
function toTime(value, formats) {
    const text = normalizeSpace(value);
    if (!text) {
        return null;
    }

    // ISO-8601 with an explicit offset (e.g. 2026-11-04T21:50:37+07:00).
    // parseZone keeps the publisher's local time instead of shifting to the
    // server timezone.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
        const iso = moment.parseZone(text);
        if (iso.isValid()) {
            return iso.format("YYYY-MM-DD HH:mm");
        }
    }

    const list = Array.isArray(formats) ? formats : [formats];
    for (const format of list) {
        if (!format) continue;
        const parsed = moment(text, format, true);
        if (parsed.isValid()) {
            return parsed.format("YYYY-MM-DD HH:mm");
        }
    }

    // Only attempt a loose parse for strings that actually look like a date.
    // This avoids moment's noisy fallback warning for relative times such as
    // "13 menit lalu".
    const looksLikeDate =
        /\d{4}/.test(text) ||
        /\b(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)\w*\b/i.test(text);
    const isRelative = /\b(lalu|ago|menit|jam|hari|minggu)\b/i.test(text);

    if (!looksLikeDate || isRelative) {
        return null;
    }

    const loose = moment(text);
    return loose.isValid() ? loose.format("YYYY-MM-DD HH:mm") : null;
}

/**
 * Parse Indonesian relative times such as "5 menit lalu" or "3 jam lalu".
 */
function toTimeFromAgo(value) {
    const text = normalizeSpace(value).toLowerCase();
    const match = text.match(/^(\d+)\s*(detik|menit|jam|hari|minggu)\s*(?:yang\s*)?lalu/);
    if (!match) {
        return null;
    }
    const units = {
        detik: "seconds",
        menit: "minutes",
        jam: "hours",
        hari: "days",
        minggu: "weeks",
    };
    return moment().subtract(Number(match[1]), units[match[2]]).format("YYYY-MM-DD HH:mm");
}

/**
 * Turn an arbitrary absolute/relative URL into an absolute URL.
 */
function absoluteUrl(href, base) {
    if (!href) return null;
    try {
        return new URL(href, base).toString();
    } catch (e) {
        return href;
    }
}

/**
 * Read the first NewsArticle-like object from JSON-LD blocks.
 */
function readJsonLd($, wantedType = "NewsArticle") {
    const blocks = $('script[type="application/ld+json"]');
    let found = null;

    blocks.each((i, el) => {
        if (found) return;
        let data;
        try {
            data = JSON.parse($(el).html());
        } catch (e) {
            return;
        }

        const candidates = [];
        if (Array.isArray(data)) {
            candidates.push(...data);
        } else if (data && Array.isArray(data["@graph"])) {
            candidates.push(...data["@graph"]);
        } else if (data) {
            candidates.push(data);
        }

        for (const candidate of candidates) {
            if (!candidate) continue;
            const types = Array.isArray(candidate["@type"]) ? candidate["@type"] : [candidate["@type"]];
            if (types.includes(wantedType)) {
                found = candidate;
                return;
            }
        }
    });

    return found;
}

/**
 * Expand English/Indonesian abbreviated month names so moment can parse them.
 */
function expandMonth(value) {
    const months = {
        jan: "Januari",
        feb: "Februari",
        mar: "Maret",
        apr: "April",
        mei: "Mei",
        may: "Mei",
        jun: "Juni",
        jul: "Juli",
        agu: "Agustus",
        aug: "Agustus",
        sep: "September",
        okt: "Oktober",
        oct: "Oktober",
        nov: "November",
        des: "Desember",
        dec: "Desember",
    };
    return normalizeSpace(value).replace(
        /\b(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)\b\.?/gi,
        (match) => months[match.toLowerCase().replace(".", "")] || match
    );
}

/**
 * Collect iframe/image/article media from a cheerio scope.
 * Call before removing those elements from the content.
 */
function collectMedia($, scope) {
    const medias = [];
    const seen = new Set();

    const push = (type, url) => {
        if (!url || seen.has(type + "|" + url)) return;
        seen.add(type + "|" + url);
        medias.push({ type, url });
    };

    scope.find("iframe").each((i, el) => {
        push("embed", $(el).attr("src") || $(el).attr("data-src"));
    });

    scope.find("img").each((i, el) => {
        const src = $(el).attr("data-src") || $(el).attr("src");
        if (src && !src.startsWith("data:")) {
            push("image", src);
        }
    });

    scope.find("article a, .baca-juga a, .baca-juga-collections a").each((i, el) => {
        push("article", $(el).attr("href"));
    });

    return medias;
}

module.exports = {
    moment,
    DEFAULT_HEADERS,
    DEFAULT_TIMEOUT,
    sleep,
    normalizeSpace,
    fetchHtml,
    errorResult,
    toTime,
    toTimeFromAgo,
    absoluteUrl,
    readJsonLd,
    expandMonth,
    collectMedia,
};
