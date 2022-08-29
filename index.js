const express = require("express");
const app = express()
const port = 3000
const tribunnews = require('./api/tribunnews');
const cnnindonesia = require('./api/cnnindonesia');
const tempo = require('./api/tempo');
const kompas = require('./api/kompas');

app.get('/', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const data = {
        message: 'Semua data hasil dari scraping',
        api:[
            {
                name: 'Tribunnews',
                all: '/tribunnews',
                section: [
                    '/tribunnews/news',
                    '/tribunnews/regional',
                    '/tribunnews/nasional',
                    '/tribunnews/internasional',
                    '/tribunnews/bisnis',
                    '/tribunnews/sport',
                    '/tribunnews/seleb',
                    '/tribunnews/lifestyle',
                    '/tribunnews/kesehatan',
                ],
                detail: '/tribunnews/:slug'
            },
            {
                name: 'CNN Indonesia',
                all: '/cnnindonesia',
                section: [
                    '/tribunnews/nasional',
                    '/tribunnews/internasional',
                    '/tribunnews/ekonomi',
                    '/tribunnews/olahraga',
                    '/tribunnews/hiburan',
                    '/tribunnews/gaya-hidup',
                    '/tribunnews/teknologi',
                ],
                detail: '/cnnindonesia/:slug'
            },
            {
                name: 'Tempo',
                all: '/tempo',
                section: [
                    '/tempo/nasional',
                    '/tempo/dunia',
                    '/tempo/metro',
                    '/tempo/bisnis',
                    '/tempo/olahraga',
                    '/tempo/bola',
                    '/tempo/gaya',
                    '/tempo/travel',
                    '/tempo/otomotif',
                    '/tempo/tekno',
                ],
                detail: '/tempo/:slug'
            },
            {
                name: 'Kompas',
                all: '/kompas',
                section: [
                    '/kompas/megapolitan',
                    '/kompas/regional',
                    '/kompas/nasional',
                    '/kompas/global',
                    '/kompas/money',
                    '/kompas/bola',
                    '/kompas/tekno',
                    '/kompas/lifestyle',
                    '/kompas/health',
                    '/kompas/otomotif',
                ],
                detail: '/kompas/:slug'
            }
        ]
    };
    res.end(JSON.stringify(data));
});

app.get('/tribunnews', async (req, res) => {
    var result = await tribunnews.getData("news");
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
});

app.get('/tribunnews/:cat', async (req, res) => {
    var result = await tribunnews.getData(req.params.cat || "news");
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
});

app.get('/tribunnews/:cat/:y/:m/:d/:slug', async (req, res) => {
    var result = await tribunnews.getDetail(`${req.params.cat}/${req.params.y}/${req.params.m}/${req.params.d}/${req.params.slug}`);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
});

app.get('/cnnindonesia', async (req, res) => {
    var result = await cnnindonesia.getData("");
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
});

app.get('/cnnindonesia/:cat', async (req, res) => {
    var result = await cnnindonesia.getData(req.params.cat || "");
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
});

app.get('/cnnindonesia/:cat/:id/:slug', async (req, res) => {
    var result = await cnnindonesia.getDetail(`${req.params.cat}/${req.params.id}/${req.params.slug}`);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
});

app.get('/tempo', async (req, res) => {
    var result = await tempo.getData("");
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
});

app.get('/tempo/:cat', async (req, res) => {
    var result = await tempo.getData(req.params.cat || "");
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
});

app.get('/tempo/:cat/:read/:id/:slug', async (req, res) => {
    var result = await tempo.getDetail(`${req.params.cat}`,`${req.params.read}/${req.params.id}/${req.params.slug}`);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
});

app.get('/kompas', async (req, res) => {
    var result = await kompas.getData("");
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
});

app.get('/kompas/:cat', async (req, res) => {
    var result = await kompas.getData(req.params.cat || "");
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
});



app.get('/kompas/:cat/:read/:y/:m/:d/:id/:slug', async (req, res) => {
    var result = await kompas.getDetail(`${req.params.cat}`,`${req.params.read}/${req.params.y}/${req.params.m}/${req.params.d}/${req.params.id}/${req.params.slug}`);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
});



app.listen(process.env.PORT || port, () => {
    console.log(`Web app listening on port ${port}`)
});

module.exports = app;