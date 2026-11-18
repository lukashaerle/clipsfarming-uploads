# Animierte Fakten-Shorts (Remotion)

Cut-out-Cartoon-Shorts, hochkant 1080×1920 mit 60 fps, Auslieferung in 4K (2160×3840). Bilder und Figuren sind
freigestellte PNGs in `public/<short>/sprites/` oder als Code gezeichnet (`src/rig/`). Kamera, Bewegung, Effekte und
Timing sind Code (`src/<short>/`), Stimme und Effekte liegen in `public/<short>/vo` und `public/<short>/sfx`.

## Kompositionen

| ID | Inhalt |
|---|---|
| `WetSand` | Ägypter + nasser Sand, englische Stimme, 28,6 s |
| `WetSandDE` | dieselbe Animation, deutsche Stimme (Zeitverzerrung `WARP_DE` in `src/wetsand/T.ts`), 31,3 s |
| `RigTest`, `RigSheet` | Test der Code-Figur |
| `Handy5h` | Pilot der Motivations-Videos: „5 Stunden am Handy“, 65 s, Musik „Spannung 03“, noch ohne Sprecher. Code in `src/motiv/`, die 20 Abschnitte mit Überschrift und Sprechtext stehen in `src/motiv/script.ts` |

## Rendern

```bash
npm ci
npx remotion render src/index.ts WetSandDE out/wetsand-DE-1080p.mp4 --crf=18            # Full HD (Instagram)
npx remotion render src/index.ts WetSandDE out/wetsand-DE-4K.mp4 --scale=2 --crf=16     # 4K-Master (TikTok, YouTube)
npx remotion studio                                                                     # Vorschau im Browser
```

Auf dem Mac nutzt Remotion die Grafikkarte (ANGLE), unter Linux bzw. in der Cloud Software-Grafik (`swangle`), siehe
`remotion.config.ts`. Unter Linux braucht der Headless-Chrome diese Pakete (Debian/Ubuntu):
`libnss3 libdbus-1-3 libatk1.0-0 libgbm1 libasound2 libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 fonts-liberation`

## Hilfsskripte (Python 3: pillow, numpy, opencv-python-headless, faster-whisper)

`images/<short>/scripts/`:
- `key.py` (Hintergrund freistellen)
- `prep.py` (zuschneiden und vermessen → `src/<short>/sprites.ts`)
- `sheet.py` und `contact.py` (Prüfbögen)
- `words.py` (Wortzeiten)
- `popscan.py` (Sprünge finden)
- `sfx_synth.py` (Soundeffekte)

## Musik und Ton

- `scripts/music/darkbeat.py <ausgabe>` baut ein eigenes, düsteres Musikstück komplett im Code (d-Moll, 85 Schläge pro Minute,
  etwa 65 Sekunden). Tempo, Tonart, Abschnitte und Lautstärken stehen als Konstanten oben im Skript. Das fertige Stück liegt
  in `public/music/spannung_01.mp3`.
- `scripts/music/peppybeat.py <ausgabe>` ist die peppigere Fassung (96 Schläge pro Minute, Clap, Hi-Hats, hüpfender Bass,
  perlende Melodie). Sie nutzt die Instrumente aus `darkbeat.py` und liegt in `public/music/spannung_02_peppig.mp3`.
- `scripts/voicetest/audio_probe.py <datei> <ordner>` vermisst den Ton einer Datei: Whisper-Mitschrift mit Wortzeiten,
  Sprechtempo, Stimmlage, Tempo, Tonart und Spektrogramme.
- `scripts/voicetest/` enthält außerdem die Skripte des Stimmentests (Piper, Mischen, Hörseite).
- `scripts/music/ambient.py <ausgabe>` baut die ruhige, dunkle Musikfläche der Erklärvideos (d-Moll, lange Akkorde, ein leiser
  Puls pro Sekunde, keine Melodie). Der Verlauf folgt dem Szenenplan der Videos. Sie liegt in `public/music/ambient_01.mp3`.
- `scripts/motiv/sfx.py <zeitplan.json> src/motiv/script.ts <ausgabe.wav>` erzeugt die Soundeffekte eines Videos: leise Klicks,
  weiche Impulse bei wichtigen Zahlen und ein leichter Whoosh bei jedem Szenenwechsel. Der Zeitplan je Video liegt in
  `scripts/motiv/cues/` und nennt pro Szene, was wann erscheint.
- `scripts/motiv/vo_align.py` findet jeden Satz des Skripts in der Sprachaufnahme, `scripts/motiv/vo_mix.py` legt die Sätze auf
  ihre Szenen und mischt Musik und Soundeffekte darunter. Geschnitten wird nur in echter Stille der Aufnahme, nie nach den
  Wortzeiten der Spracherkennung allein: Die enden bis zu 0,3 Sekunden zu früh und schneiden sonst Satzenden an. Stehen Sätze
  zu dicht, werden sie so verteilt, dass zwischen allen eine natürliche Pause bleibt; schneller gesprochen wird nur im Notfall.
- `scripts/voicetest/listen.py <mix.json> src/motiv/script.ts <ordner> [align.json]` hört die fertige Sprachspur ab und meldet,
  was nicht stimmt: Schnitte durch einen Laut, fehlende oder falsch zugeordnete Wörter (jeder Satz wird einzeln abgehört),
  Pausen mitten im Satz, zu enge Abstände, beschleunigte Sätze, Lautstärkesprünge. Dazu zeichnet es jedes Satzende und jeden
  Satzanfang als Spektrogramm mit der Schnittmarke. Vor jedem Verschicken eines Videos laufen lassen (`vo_mix.py` dafür mit
  `voice=<datei.wav>` aufrufen).
- `scripts/motiv/remux_audio.py <video> <ton> <ausgabe> 64.0 64.9` tauscht nur die Tonspur eines fertigen Videos aus. Das Bild
  wird dabei unverändert kopiert, ein neues Rendern ist nicht nötig.
- `scripts/voicetest/voice_profile.py` misst eine Stimme (Tonhöhe, Melodie, Tempo, Pausen, Helligkeit, Stimmgröße),
  `lib_scan.py` ordnet Stimmproben nach Nähe zu einer Vorgabe, `tighten.py` kürzt Pausen und hebt das Tempo ohne die Tonhöhe
  zu ändern, `fit_batch.py` erledigt Messen, Straffen und Mischen für eine ganze Liste von Proben.

Remotion ist für Einzelpersonen kostenlos (Lizenzbedingungen auf remotion.dev).
