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
        "/tribunnews/nasional",
        "/tribunnews/internasional",
        "/tribunnews/ekonomi",
        "/tribunnews/olahraga",
        "/tribunnews/hiburan",
        "/tribunnews/gaya-hidup",
        "/tribunnews/teknologi"
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
    }
  ]
}
```