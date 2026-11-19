# Posttexte Lebensrechnung (Regeln)

Für jedes Video gibt es `lebensrechnung/posts/<id>.json`:
`{"id", "title", "date" (YYYY-MM-DD, Berlin), "time" ("12:30"/"19:00"), "at" (UTC, ISO), "text" (TikTok + Instagram),
"yt_title", "yt_text", "tags" (6 Stück, ohne #), "status"}`. Status: `entwurf` → `freigabe-angefragt` → `eingeplant` oder `gestoppt`.

Fehlt die Datei für ein produziertes Video, schreibe sie nach diesen Regeln (Beispiele: die vorhandenen Dateien):
- **text** (TikTok/Instagram): 1. Zeile = Hook aus dem ersten Satz des Videos plus ein passendes Emoji. Leerzeile. 1–2 Sätze
  Kernaussage. Leerzeile. Eine Frage an die Zuschauer. Leerzeile. 6 Hashtags, der letzte immer `#lebensrechnung`.
- **yt_title**: höchstens 60 Zeichen, endet mit ` #shorts`.
- **yt_text**: Hook, Leerzeile, die Rechnung mit allen Zahlen und Quellen aus `remotion/videos/<id>/spec.json` und
  `themen`-Quellen im Video, Annahmen mit „wenn“, eine Einordnung (Durchschnitt/Schätzung), Leerzeile, 4 Hashtags mit
  `#shorts` vorne und `#lebensrechnung` hinten.
- Nur Zahlen, die im Skript stehen. Keine Gesundheitsversprechen, kein Vorwurf, ruhiger Ton, Du-Form.
- `at`: 12:30 Berlin = 11:30 UTC und 19:00 Berlin = 18:00 UTC im Winter (MEZ), im Sommer (MESZ) 10:30 bzw. 17:00 UTC.
