const axios = require("axios");
const cheerio = require("cheerio");
const moment = require('moment');
moment.locale('id');

const months = [
    {
        'short': 'Jan',
        'long': 'Januari'
    },
    {
        'short': 'Feb',
        'long': 'Februari'
    },
    {
        'short': 'Mar',
        'long': 'Maret'
    },
    {
        'short': 'Apr',
        'long': 'April'
    },
    {
        'short': 'Mei',
        'long': 'Mei'
    },
    {
        'short': 'Jun',
        'long': 'Juni'
    },
    {
        'short': 'Jul',
        'long': 'Juli'
    },
    {
        'short': 'Agu',
        'long': 'Agustus'
    },
    {
        'short': 'Sep',
        'long': 'September'
    },
    {
        'short': 'Okt',
        'long': 'Oktober'
    },
    {
        'short': 'Nov',
        'long': 'November'
    },
    {
        'short': 'Des',
        'long': 'Desember'
    }

];

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


const base_url = "https://www.liputan6.com";

async function getData(category) {
    const url = base_url + "/" + category.toLowerCase();
    let result = [];
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const isi = $(".articles--iridescent-list article");

        isi.each((i, e) => {
            const title = $('.articles--iridescent-list--text-item__title-link-text', e).text().replace("\n", "").trim();
            const time = $('.articles--iridescent-list--text-item__time', e).text().trim();
            if (title != "" && time != "") {

                const image_thumbnail = $('picture.articles--iridescent-list--text-item__figure-image img', e).attr('src');
                // const image_full = (image_thumbnail) ? image_thumbnail.replace("thumbnails2", "images") : "";
                // const description = $(e).children('div.mr140').children('div.txt-oev-3').text().replace("\n", "").trim();

                const link = $('h4.articles--iridescent-list--text-item__title a', e).attr('href');
                const slug = (link != undefined) ? link.replace(base_url, "") : "";

                const timeArr = time.split(" ");
                for (let i = 0; i < months.length; i++) {
                    const month = months[i];
                    if (month.short == timeArr[1]) {
                        timeArr[1] = month.long;
                    }
                }

                const theTime = timeArr.join(" ").replace(" WIB", "");
                let newTime = moment(theTime, 'DD MMMM YYYY hh:mm').format('YYYY-MM-DD hh:mm');

                // let newTime = moment(time, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm');
                result.push({
                    title: title,
                    image_thumbnail: image_thumbnail,
                    image_full: null,
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
    const url = "https://m.liputan6.com/" + slug + "?page=all";

    let result = {};
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const title = $(".article h1.article-header__title");
      
        const content = $(".article div.read-page-upper div.article-content-body");
        $("script", content).remove();
        const image = $(".article .article-photo-gallery--item__content img");
        const time = $(".article span.article-header__datetime").text().replace(" pada ","");
        const timeArr = time.split(" ");
        for (let i = 0; i < months.length; i++) {
            const month = months[i];
            if (month.short == timeArr[1]) {
                timeArr[1] = month.long;
            }
        }

        const theTime = timeArr.join(" ").replace(" WIB", "");
        let newTime = moment(theTime, 'DD MMMM YYYY, hh:mm').format('YYYY-MM-DD hh:mm');
        let medias = [];
        const yts = $("figure iframe", content);
        yts.each((i, e) => {
            const yt = $(e).attr('src');
            medias.push({
                type: 'youtube',
                url: yt
            });
        });
        const imgs = $("img", content);
        imgs.each((i, e) => {
            const img = $(e).attr('data-src');
            if(!img.includes("blank") && !img.includes(".gif")){
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
            'image': image.attr('src'),
            'time': (newTime != "Invalid date")?newTime:theTime,
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