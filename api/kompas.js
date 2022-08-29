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



const base_url = "https://www.kompas.com";

async function getData(category) {
    let url = `https://${category.toLowerCase()}.kompas.com`;
    if (category == "") {
        url = base_url;
    }

    let result = [];
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const isi = $(".col-bs10-7 .article__list.clearfix");

        isi.each((i, e) => {
            const title = $('.article__list__title h3 a', e).text().replace("\n", "").trim();


            if (title != "") {
                const image_thumbnail = $('.article__list__asset .article__asset a img', e).attr('data-src');
                var image_full = image_thumbnail.replace(/crops.*data/, 'data').replace("crops", "");
                var time = $('.article__date', e).text().trim().replace(" WIB", "");
                // const description = $(e).children('div.mr140').children('div.txt-oev-3').text().replace("\n", "").trim();
                // const time = $(e).children('div.mr140').children('.grey').children('time').attr('title');
                const link = $('.article__list__title h3 a', e).attr('href');
                const _url = new URL(link);
                if (_url.hostname !== "www.kompas.id") {
                    const _replace = "https://" + _url.hostname;
                    const _arr_hostname = _url.hostname.split(".");
                    let slug = (link != undefined) ? link.replace(_replace, "") : "";
                    if (_arr_hostname.length > 1 && _arr_hostname[0] != "www") {
                        slug = _arr_hostname[0] + slug;
                    } else if (slug.charAt(0) == "/") {
                        slug = slug.slice(1);
                    }


                    // let newTime = moment(time, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm');
                    result.push({
                        title: title,
                        image_thumbnail: image_thumbnail,
                        image_full: image_full,
                        time: moment(time, "dd/MMMM/YYYY, hh:mm").format('YYYY-MM-DD hh:mm'),
                        link: link,
                        slug: slug
                    });
                }
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

async function getDetail(category, slug) {
    let url = `https://${category.toLowerCase()}.kompas.com/${slug}?page=all`;
    if (category.toLowerCase() == "baca") {
        url = `https://kompas.com/${category.toLowerCase()}/${slug}?page=all`;
    }

    let result = {};
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const _element_article = $(".container.clearfix");
        const title = $("h1.read__title", _element_article);
        const content = $(".read__content", _element_article);
        $("script", content).remove();


        const image = $('.cover-photo img', _element_article).attr('src').replace(/crops.*data/, 'data').replace("crops", "");
        // var img_url = new URL(image);
        // var search_params = img_url.searchParams;
        // search_params.set('w', '1024');
        // search_params.set('q', '100');
        // img_url.search = search_params.toString();
        // var image_full = img_url.toString();

        const timeElement = $(".read__time", _element_article);
        $("a", timeElement).remove();
        const time = timeElement.text().trim().replace(" WIB", "").replace(" - ", "");


        let newTime = moment(time, "dd/MMMM/YYYY, hh:mm").format('YYYY-MM-DD hh:mm');

        let medias = [];
        const yts = $("iframe", content);
        yts.each((i, e) => {
            const yt = $(e).attr('src');
            medias.push({
                type: 'youtube',
                url: yt
            });
        });
        const imgs = $("img", content);
        imgs.each((i, e) => {
            const img = $(e).attr('src');
            if ($(e).closest(".lihatjg").length <= 0) {
                medias.push({
                    type: 'image',
                    url: img
                });
            }

        });
        const articles = $("article", content);
        articles.each((i, e) => {
            const article = $('a', e).attr('href');
            medias.push({
                type: 'article',
                url: article
            });
        });

        result = {
            'title': title.text().replace("\n", "").trim(),
            'content': content.text().replace("\n", "").trim(),
            'image': image,
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