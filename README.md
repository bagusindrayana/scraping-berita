## Instalasi
- `npm install`
- `npm start`

## Library yang digunakan
- axios
- cheerio
- express
- moment

## API

```json
{
  "message": "Semua data hasil dari scraping",
  "api": [
    {
      "name": "Tribunnews",
      "all": "/tribunnews",
      "section": [
        "/tribunnews/news",
        "/tribunnews/regional",
        "/tribunnews/nasional",
        "/tribunnews/internasional",
        "/tribunnews/bisnis",
        "/tribunnews/sport",
        "/tribunnews/seleb",
        "/tribunnews/lifestyle",
        "/tribunnews/kesehatan"
      ],
      "detail": "/tribunnews/:slug"
    },
    {
      "name": "CNN Indonesia",
      "all": "/cnnindonesia",
      "section": [
        "/cnnindonesia/nasional",
        "/cnnindonesia/internasional",
        "/cnnindonesia/ekonomi",
        "/cnnindonesia/olahraga",
        "/cnnindonesia/hiburan",
        "/cnnindonesia/gaya-hidup",
        "/cnnindonesia/teknologi"
      ],
      "detail": "/cnnindonesia/:slug"
    },
    {
      "name": "Tempo",
      "all": "/tempo",
      "section": [
        "/tempo/nasional",
        "/tempo/dunia",
        "/tempo/metro",
        "/tempo/bisnis",
        "/tempo/olahraga",
        "/tempo/bola",
        "/tempo/gaya",
        "/tempo/travel",
        "/tempo/otomotif",
        "/tempo/tekno"
      ],
      "detail": "/tempo/:slug"
    },
    {
      "name": "Kompas",
      "all": "/kompas",
      "section": [
        "/kompas/megapolitan",
        "/kompas/regional",
        "/kompas/nasional",
        "/kompas/global",
        "/kompas/money",
        "/kompas/bola",
        "/kompas/tekno",
        "/kompas/lifestyle",
        "/kompas/health",
        "/kompas/otomotif"
      ],
      "detail": "/kompas/:slug"
    },
    {
      "name": "Liputan 6",
      "all": "/liputan6",
      "section": [
        "/liputan6/news",
        "/liputan6/crypto",
        "/liputan6/saham",
        "/liputan6/bisnis",
        "/liputan6/bola",
        "/liputan6/showbiz",
        "/liputan6/tekno",
        "/liputan6/cek-fakta",
        "/liputan6/islami",
        "/liputan6/regional"
      ],
      "detail": "/liputan6/:slug"
    }
  ]
}
```

## Support

<a href="https://trakteer.id/bagood/tip" target="_blank"><img id="wse-buttons-preview" src="https://cdn.trakteer.id/images/embed/trbtn-red-1.png" height="40" style="border:0px;height:40px;" alt="Trakteer Saya"></a>