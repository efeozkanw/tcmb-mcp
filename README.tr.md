# tcmb-mcp

Türkiye Cumhuriyet Merkez Bankası'nın (TCMB) günlük döviz kurları için bir MCP sunucusu.

Resmi XML bültenlerini doğrudan tcmb.gov.tr'den okur, API anahtarı gerektirmez. Genelde hatalı yapılan kısımları doğru ele alır: hafta sonu ve resmi tatiller, 15:30 yayın saati, 100 birim üzerinden kotasyonu yapılan dövizler, yayımlanmayan kurlar ve dövizli faturada kullanılması gereken kur.

[English](README.md)

## Kurulum

Node.js 22.12 veya üstü gerekir.

**Claude Code**

```bash
claude mcp add tcmb -- npx -y tcmb-mcp
```

Tüm projelerde kullanmak için `--scope user` ekleyin.

**Claude Desktop, Cursor, Windsurf**

`claude_desktop_config.json`, `~/.cursor/mcp.json` ya da ilgili dosyaya ekleyin:

```json
{
  "mcpServers": {
    "tcmb": {
      "command": "npx",
      "args": ["-y", "tcmb-mcp"]
    }
  }
}
```

VS Code yapılandırması için [İngilizce README](README.md#install).

## Araçlar

| Araç                   | Ne yapar                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `tcmb_get_rates`       | Son bültenin ya da verilen bir tarihin kurları; tüm dövizler veya seçilenler. `response_format: "detailed"` isimleri ve efektif kurları ekler. |
| `tcmb_convert`         | TL ile döviz arasında ya da iki döviz arasında (TL kurları üzerinden) çevirir.                                                                 |
| `tcmb_invoice_rate`    | Dövizli fatura kuru: fatura tarihinden önceki son bülten, varsayılan olarak döviz alış. İstenirse TL karşılığını kuruşa yuvarlayarak verir.    |
| `tcmb_get_history`     | Bir dövizin tarih aralığındaki seyri; günlük, haftalık veya aylık. İlk, son, en düşük, en yüksek ve yüzde değişim.                             |
| `tcmb_list_currencies` | Bültendeki dövizler, Türkçe ve İngilizce isimleri, kotasyon birimi ve yayımlanan kur türleri.                                                  |

Örnek sorular:

- Bugün euro satış kuru kaç?
- 2 Ocak 2026 tarihli 3.400 USD'lik fatura keseceğim, TL karşılığı ne olmalı?
- 2025'te dolar ay ay nasıl değişti?
- 15 Mart 2024 kurlarıyla 250 GBP kaç EUR eder?

## Tarihler nasıl ele alınır

- TCMB her iş günü saat 15:30'da bir bülten açıklar. Bu saatten önce en güncel bülten bir önceki iş gününe aittir.
- Hafta sonu, resmi tatil ve dini bayram arifelerinde bülten yayımlanmaz. Böyle bir tarih istendiğinde ondan önceki en yakın bülten döner. Her yanıtta `requested_date`, `bulletin_date` ve `fallback_reason` (`weekend`, `holiday`, `not_published_yet`) bulunur.
- `tcmb_invoice_rate` her zaman fatura tarihinden önceki bülteni kullanır; bu, o gün Resmi Gazete'de yayımlanan kurdur. Pazartesi tarihli fatura cuma kurunu kullanır.
- Kurlar bir birim döviz başına TL'dir. JPY gibi 100 birim üzerinden verilenler bölünür.
- 2005 öncesi bültenler eski TL cinsindendir ve yeni TL'ye çevrilir (1 TRY = 1.000.000 TRL).
- Arşiv 16 Nisan 1996'ya kadar gider.

## Veri ve sorumluluk

Veriler TCMB'nin [tcmb.gov.tr](https://www.tcmb.gov.tr/kurlar/kurlar_tr.html) adresinde yayımladığı gösterge niteliğindeki kurlardır. Bu proje TCMB ile bağlantılı değildir. Muhasebe veya vergi işlemlerinde kullanmadan önce resmi kaynakla karşılaştırın.

Enflasyon, faiz, rezerv gibi makroekonomik seriler için TCMB'nin kendi EVDS MCP sunucusunu kullanın.

## Lisans

[MIT](LICENSE)
