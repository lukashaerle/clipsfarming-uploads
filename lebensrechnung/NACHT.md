# Nacht-Produktion Lebensrechnung (Anleitung für die Cloud-Routine)

Du produzierst die Videos des Kanals **Lebensrechnung** für den heutigen Tag. Du postest NICHTS, du benutzt kein vidIQ,
und du fasst nichts an, was zu **Faktenfabrik** gehört (Repo faktenfabrik-uploads, deren Slack-Kanäle, deren Routinen).
Gepostet wird erst morgens nach Freigabe in der App.

## 1. Was ist heute dran?
- `HEUTE=$(TZ=Europe/Berlin date +%F)`, `MORGEN=$(TZ=Europe/Berlin date -d tomorrow +%F)`; lies `lebensrechnung/plan.json`,
  Einträge für beide Tage (Uhrzeit → Video-ID). Zuerst heute, dann morgen, jeweils in der Reihenfolge der Uhrzeit.
- Tage unter `"_pause"."tage"` in plan.json sind Pausentage: dort nichts produzieren und nichts zur Freigabe schicken.
- Ein Video ist zu produzieren, wenn `remotion/videos/<id>/spec.json` existiert und `lebensrechnung/<id>-report.txt` auf main fehlt
  (ältere Videos liegen noch als mp4 auf main; auch dann gilt es als fertig).
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
- Text: bei `"style": "action"` in der Spec `"[confident] [energetic] "`, sonst `"[calm] "`, dann die `vo`-Felder aller Szenen der Spec, mit Zeilenumbruch verbunden, unverändert.
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
Dauer ungefähr: Ton 1 Min, Full HD 10 Min, 4K 25 Min pro Video. Der Action-Stil (Spec mit `"style": "action"`) braucht keine Extra-Schritte: Tempo, Beat, Schnitte und Untertitel macht `night.sh` selbst. Das Skript ist fortsetzbar (fertige 4K-Abschnitte werden übersprungen).
Danach:
- **Videos** kommen NICHT auf `main`, sondern auf den Branch `lr-videos`:
  `bash remotion/scripts/lr/push_videos.sh lebensrechnung/<id>-1080p.mp4 lebensrechnung/<id>-4K.mp4`
  (im Repo-Wurzelordner; gibt den Commit aus). Die mp4-Dateien danach NICHT auf main committen (sie sind per .gitignore ausgeschlossen).
- Auf `main` committen und pushen (vorher `git pull --rebase`): `lebensrechnung/<id>-report.txt`,
  `remotion/videos/<id>/take.mp3`, `remotion/videos/<id>/words.json` (falls vorhanden).
  Commit-Nachricht: `Lebensrechnung <id>: produziert (Videos auf lr-videos)`.
- „Fertig“ heißt ab jetzt: `lebensrechnung/<id>-report.txt` auf main UND die Videos auf `lr-videos`
  (`git fetch origin lr-videos && git ls-tree -r --name-only origin/lr-videos`). Das gilt auch für Schritt 1.

## 5. Meldung (Slack, Lebensrechnung Bot)
Zwei Umgebungsvariablen, beide geheim (**nie ausgeben, nie in Dateien, Logs oder Commits schreiben**):
- `SLACK_WEBHOOK_LR_UPLOADS` → #lebensrechnung-uploads (C0CJMNQ7TBR): nach erfolgreicher Produktion.
- `SLACK_WEBHOOK_LR_FEHLER` → #lebensrechnung-fehler (C0CK6R2MQSG): wenn ein Schritt scheitert.

Nachricht mit Python als JSON bauen (`{"text": "..."}`, nach /tmp/msg.json), dann
`curl -s -X POST -H 'Content-type: application/json' --data @/tmp/msg.json "$SLACK_WEBHOOK_LR_UPLOADS"` (bzw. FEHLER).
Die Antwort muss genau `ok` sein.
- Jede Nachricht beginnt mit `<@U0CJ23KT5MK>` (Erwähnung von Lukas, damit eine Push-Nachricht kommt).
- Formatierung: *fett*, Links als <url|Text>.
- Erfolg, pro Video: *„<Titel>“* fertig (die ID nur klein dahinter) für <Datum, Uhrzeit>; Länge; Hörprüfung („ok“ oder „bitte anhören“
  plus erste Auffälligkeit); sichere Zone; verbrauchte Credits; Link zum 1080p-Video im Repo
  (https://github.com/lukashaerle/clipsfarming-uploads/blob/main/lebensrechnung/<id>-1080p.mp4); Schluss: „Freigabe morgens in der App“.
- Fehler: „⚠️ *LEBENSRECHNUNG Nacht-Produktion abgebrochen* – <Schritt>: <letzte Fehlerzeile>“.

**Notfall-Weg:** Fehlt eine Variable oder antwortet der Webhook nicht mit `ok`, poste dieselbe Nachricht über den Slack-Connector
(`slack_send_message`) in den passenden Kanal (C0CJMNQ7TBR bzw. C0CK6R2MQSG) und schreibe ans Ende:
„(über Connector gesendet, Webhook nicht erreichbar)“. Der Slack-Connector darf **ausschließlich** diese zwei Kanäle benutzen:
nichts lesen, nichts in andere Kanäle oder Direktnachrichten schreiben, niemals die Faktenfabrik-Kanäle (#uploads, #fehler, #tagesreview).

## 6. Freigabe-Anfrage in Slack (nach dem Push, für jedes heute fertig gewordene Video)
1. Stelle sicher, dass `lebensrechnung/posts/<id>.json` existiert (sonst nach `lebensrechnung/POSTTEXTE.md` schreiben),
   setze `"status": "freigabe-angefragt"`, committe und pushe.
2. Lade das Full-HD-Video über den Slack-Connector nach #lebensrechnung-uploads (C0CJMNQ7TBR):
   `slack_get_file_upload_url` (filename `<id>.mp4`, content_length = exakte Dateigröße), Datei per
   `curl -s -X POST -H 'Content-Type: video/mp4' --data-binary @lebensrechnung/<id>-1080p.mp4 "$URL"` hochladen
   (URL in eine Variable, nie umschreiben), dann `slack_complete_file_upload` mit `channel_id: C0CJMNQ7TBR`,
   `title: "<Titel>"` und diesem `initial_comment`:
   ```
   **Freigabe: „<Titel>“** – <Wochentag> <TT.MM.>, <time> Uhr (TikTok, Instagram, YouTube)

   **TikTok und Instagram:**
   ><text, jede Zeile mit > davor>

   **YouTube:** <yt_title>
   ><yt_text, gekürzt auf die ersten 3 Zeilen>

   ✅ = so einplanen · ❌ = nicht posten · Änderungswunsch als Antwort im Thread
   Freigabe-ID: <id>
   ```
   (Der Slack-Connector nutzt normales Markdown: **fett**. Die Webhook-Nachrichten nutzen *fett*.)
   Dies ist der einzige erlaubte Einsatz des Slack-Connectors außer dem Notfall-Weg aus Abschnitt 5.
3. Zum Schluss eine Bot-Nachricht per `$SLACK_WEBHOOK_LR_UPLOADS`:
   `<@U0CJ23KT5MK> *Freigabe gesucht:* „<Titel 1>“ (<time>) und „<Titel 2>“ (<time>) – bitte ✅ unter das jeweilige Video.`
   Eingeplant wird danach automatisch vom Mac (Aufgabe „Lebensrechnung Freigabe“), sobald dein ✅ da ist.
