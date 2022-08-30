const axios = require("axios");
const cheerio = require("cheerio");
const moment = require('moment');
moment.locale('id');


function getDateFromTimeAgo(timeString) {
    const timeAgo = { hours: 0, minutes: 0, seconds: 0 };

    const secondsAgoMatches = timeString.match(/^(\d+) (detik? yang lalu)/);
    const minutesAgoMatches = timeString.match(/^(\d+) (menit? yang lalu)/);
    const hoursAgoMatches = timeString.match(/^(\d+) (jam? yang lalu)/);
    const hoursAndMinutesAgoMatches = timeString.match(/^(\d+) (jam? dan) (\d+) (menit? yang lalu)/);

    if (secondsAgoMatches) {
        timeAgo.seconds = secondsAgoMatches[1];
    }
    if (minutesAgoMatches) {
        timeAgo.minutes = minutesAgoMatches[1];
    }
    if (hoursAgoMatches) {
        timeAgo.hours = hoursAgoMatches[1];
    }
    if (hoursAndMinutesAgoMatches) {
        timeAgo.hours = hoursAndMinutesAgoMatches[1];
        timeAgo.minutes = hoursAndMinutesAgoMatches[3];
    }

    return moment()
        .subtract(timeAgo.seconds, 'seconds')
        .subtract(timeAgo.minutes, 'minutes')
        .subtract(timeAgo.hours, 'hours')
        .format('YYYY-MM-DD hh:mm');

}


const base_url = "https://www.tribunnews.com";

async function getData(category) {
    const url = base_url + "/" + category.toLowerCase();
    let result = [];
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const isi = $("li.art-list.pos_rel");

        isi.each((i, e) => {
            const title = $(e).children('div.mr140').children('h3').children('a').text().replace("\n", "").trim();
            if (title != "") {
                const image_thumbnail = $(e).children('div.fr').children('a').children('img').attr('src');
                const image_full = (image_thumbnail) ? image_thumbnail.replace("thumbnails2", "images") : "";
                // const description = $(e).children('div.mr140').children('div.txt-oev-3').text().replace("\n", "").trim();
                const time = $(e).children('div.mr140').children('.grey').children('time').attr('title');
                const link = $(e).children('div.mr140').children('h3').children('a').attr('href');
                const slug = (link != undefined) ? link.replace(base_url, "") : "";

                let newTime = moment(time, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm');
                result.push({
                    title: title,
                    image_thumbnail: image_thumbnail,
                    image_full: image_full,
                    // description: description,
                    time: newTime,
                    link: link,
                    slug: slug
                });
            }
        });
    } catch (error) {
        console.log(error);
        result = {
            'error': error
        };
    }
    return result;
}

async function getDetail(slug) {
    const url = "https://m.tribunnews.com/" + slug + "?page=all";
    let result = {};
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const title = $("#article .pa15 h1.f32");
        const content = $("div.txt-article");
        $("script", content).remove();
        const image = $("#article a.glightbox img.wfull");
        const time = $("#article div.mt10 time");
        const theTime = time.attr('datetime').replace(" WIB", "");
        let newTime = moment(theTime, 'dddd, DD MMMM YYYY hh:mm').format('YYYY-MM-DD hh:mm');
        let medias = [];
        const yts = $("figure iframe",content);
        yts.each((i, e) => {
            const yt = $(e).attr('src');
            medias.push({
                type: 'youtube',
                url: yt
            });
        });
        const imgs = $("img",content);
        imgs.each((i, e) => {
            const img = $(e).attr('src');
            medias.push({
                type: 'image',
                url: img
            });
        });
        const articles = $("article",content);
        articles.each((i, e) => {
            const article = $('a',e).attr('href');
            medias.push({
                type: 'article',
                url: article
            });
        });

        result = {
            'title': title.text().replace("\n", "").trim(),
            'content': content.text().replace("\n", "").trim(),
            'image': image.attr('src'),
            'time': newTime,
            'media': medias
        };

    } catch (error) {

        result = {
            'error': error
        };
    }
    return result;
}

module.exports = {
    getData: getData,
    getDetail: getDetail
};