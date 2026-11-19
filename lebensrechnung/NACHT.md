# Nacht-Produktion Lebensrechnung (Anleitung für die Cloud-Routine)

Du produzierst die Videos des Kanals **Lebensrechnung** für den heutigen Tag. Du postest NICHTS, du benutzt kein vidIQ,
und du fasst nichts an, was zu **Faktenfabrik** gehört (Repo faktenfabrik-uploads, deren Slack-Kanäle, deren Routinen).
Gepostet wird erst morgens nach Freigabe in der App.

## 1. Was ist heute dran?
- `HEUTE=$(TZ=Europe/Berlin date +%F)`, `MORGEN=$(TZ=Europe/Berlin date -d tomorrow +%F)`; lies `lebensrechnung/plan.json`,
  Einträge für beide Tage (Uhrzeit → Video-ID). Zuerst heute, dann morgen, jeweils in der Reihenfolge der Uhrzeit.
- Ein Video ist zu produzieren, wenn `remotion/videos/<id>/spec.json` existiert und `lebensrechnung/<id>-4K.mp4` fehlt.
- Fehlt für einen Termin von heute die Spec, melde das (Schritt 5). Gibt es gar nichts zu tun, melde kurz „nichts zu tun“ und hör auf.

## 2. Vorbereitung (einmal)
```
cd remotion && npm ci --no-audit --no-fund
pip install --break-system-packages numpy av pillow || pip install numpy av pillow
pip install --break-system-packages faster-whisper || true   # optional, für die Hörprüfung und als Ersatz für Scribe
```
Remotions eigener Chrome-Download ist in der Cloud gesperrt; `night.sh` nimmt automatisch `/opt/pw-browsers/chromium`.
Fehlen beim Rendern Bibliotheken, installiere sie mit apt (Ubuntu 24.04: libasound2t64 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libnss3 libgbm1 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libpango-1.0-0).

## 3. Stimme (ElevenLabs-Connector), pro Video
- Text: `"[calm] "` + die `vo`-Felder aller Szenen der Spec, mit Zeilenumbruch verbunden, unverändert.
- `creative_generate_speech` mit `model_id: "eleven_v4"`, `voice_id: "Y4Kanv4K4TPlPhoBZKmC"`, `flow_id: "1k5YaqMshbFJYOc9DZRE"`,
  `generations_count: 1`. Den Status mit `creative_get_flow_run_status` abfragen, bis er fertig ist.
- **Eine Generierung kostet Credits: nie einen gestarteten Auftrag wiederholen.** Nur wenn nachweislich kein Audio entstanden ist,
  ist genau ein zweiter Versuch erlaubt.
- Audio als `remotion/videos/<id>/take.mp3` speichern (Download-URL aus dem Ergebnis, mit curl).
- Wortzeiten: `creative_transcribe_audio` mit `model_id: "eleven_scribe_v1"`, `flow_id` wie oben, `connect_from: [<Knoten der Stimme>]`.
  Wenn das Ergebnis Wörter mit Start/Ende liefert, schreibe `remotion/videos/<id>/words.json` als
  `{"words": [{"w": "Wort", "s": 0.12, "e": 0.40}, ...]}` (Sekunden). Ohne Wortzeiten diese Datei weglassen; dann nimmt das Skript Whisper.

## 4. Ton, Prüfung, Rendern
```
cd remotion && bash scripts/lr/night.sh <id> ../lebensrechnung
```
Dauer ungefähr: Ton 1 Min, Full HD 10 Min, 4K 25 Min pro Video. Das Skript ist fortsetzbar (fertige 4K-Abschnitte werden übersprungen).
Danach committen und auf `main` pushen (vorher `git pull --rebase`):
`lebensrechnung/<id>-1080p.mp4`, `lebensrechnung/<id>-4K.mp4`, `lebensrechnung/<id>-report.txt`,
`remotion/videos/<id>/take.mp3`, `remotion/videos/<id>/words.json` (falls vorhanden).
Commit-Nachricht: `Lebensrechnung <id>: Full HD und 4K (Nacht-Produktion)`.

## 5. Meldung (Slack, Lebensrechnung Bot)
Zwei Umgebungsvariablen, beide geheim (**nie ausgeben, nie in Dateien, Logs oder Commits schreiben**):
- `SLACK_WEBHOOK_LR_UPLOADS` → Kanal #lebensrechnung-uploads: nach erfolgreicher Produktion.
- `SLACK_WEBHOOK_LR_FEHLER` → Kanal #lebensrechnung-fehler: wenn ein Schritt scheitert (welcher Schritt, letzte Fehlerzeile).
Senden: Nachricht als JSON `{"text": "..."}` in eine Datei unter /tmp schreiben, dann
`curl -s -X POST -H 'Content-type: application/json' --data @/tmp/msg.json "$SLACK_WEBHOOK_LR_UPLOADS"` (bzw. FEHLER).
Inhalt bei Erfolg, pro Video: ID und Titel, Sendetermin, Länge, Hörprüfung („ok“ oder „bitte anhören“ plus erste Auffälligkeit),
sichere Zone, verbrauchte Credits, Schluss: „Freigabe morgens in der App“.
Fehlt eine Variable, die Meldung nur in der Abschlussantwort geben. Nie die Faktenfabrik-Kanäle oder deren Bot benutzen.
