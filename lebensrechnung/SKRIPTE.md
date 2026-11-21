# Skripte schreiben (Lebensrechnung)

Ein Video ist eine Datei `remotion/videos/<id>/spec.json` (Typen: `remotion/src/lr/spec.ts`). `<id>` = dreistellige laufende
Nummer + Kurzname, z. B. `011-buecher`. Beispiele: alle vorhandenen `remotion/videos/*/spec.json`.

## Woher die Inhalte kommen
- Nur aus `lebensrechnung/themen/wochenplan-*.md`: Hook, Kernaussage, Zahlen mit Quellen, Bildideen, Schlusssatz, Hinweise.
  Keine eigenen Zahlen, keine Recherche. Was im Plan als (a) Rechnung steht, als Annahme mit „wenn“ formulieren.
- Welche Themen schon verbraucht sind, steht in `lebensrechnung/themen/verbraucht.json` (Arbeitstitel → id). Nimm die nächsten
  unverbrauchten Themen in der Reihenfolge des Plans; A-Themen auf 12:30, B-Themen auf 19:00, wenn möglich.
- Gehen die unverbrauchten Themen zur Neige (weniger als 4), schreibe trotzdem, was geht, und melde es (siehe Routine).

## Aufbau (Punch-Stil, seit 21.11.2026 Standard für alle neuen Videos)
Vorbild: `remotion/videos/007-aufschieben/spec.json`. Lies es ganz, bevor du schreibst. Ältere Specs mit `"style": "action"`
sind kein Vorbild mehr.
- Spec beginnt mit `"style": "punch"`. Kein `accent` setzen (Standard ist Gelb).
- **12–14 Szenen**, jede mit **einem kurzen Satz** (höchstens ~50 Zeichen). Sprechtext gesamt **430–520 Zeichen** (≈ 30–35 s).
- **Keine Überschriften:** in jeder Szene `"head": ""`. Den Satz tragen die Untertitel (Wort für Wort, automatisch aus `vo`),
  die Grafik zeigt nur die Zahl oder das Bild dazu.
- **Szene 1 = Hook als `statement`.** Ihr erstes Bild ist das Vorschaubild. **Hook-Test:** jedes Skript bekommt einen von vier
  Hook-Typen, im Wechsel, so dass jeder Typ etwa gleich oft vorkommt (Zählung in `lebensrechnung/hooks.json`, dort die neue id mit
  Typ eintragen): `frage` („Wie oft siehst du deine Eltern noch?“), `zahl` (Schockzahl zuerst: „Aufschieben kostet heute nur 2 Minuten.“),
  `mythos` (verbreiteter Irrtum, sofort widerlegt: „21 Tage, dann sitzt die Gewohnheit?“ → „Leider nein.“),
  `szene` (Mini-Szene, die man vor sich sieht: „Sie hat keinen Tropfen getrunken.“). Steht in `hooks.json` unter `"bevorzugt"`
  ein Typ, nimm diesen bei jedem zweiten Skript. Szene 2 löst sofort auf („Am Ende kostet es 15 Stunden.“, „Von wegen. …“).
- **`statement`-Szenen sind Schrift im Takt der Stimme:** die `lines` enthalten **genau die Wörter von `vo`**, in derselben
  Reihenfolge und Schreibweise (jedes Wort erscheint, wenn es gesprochen wird). 2–3 Zeilen, je Zeile 7–18 Zeichen: jede Zeile
  wird auf dieselbe Breite gezogen, kurze Zeilen werden also groß. Die Kernaussage mit `*…*` markieren, das darf mehrere
  Wörter umfassen: `["Aufschieben", "kostet heute", "nur *2 Minuten.*"]`. Höchstens 5 statements pro Video (Hook, Auflösung,
  eine Wende, Schlusssatz, Schleifen-Satz).
- **Ein Bruch:** genau eine `statement`-Szene im letzten Drittel (die Wende oder Kernaussage) bekommt `"invert": true`
  (ganzes Bild in der Signalfarbe).
- **Steigerung zeigen:** Wenn Werte wachsen oder sich vergleichen lassen, nimm ein `rise`-Diagramm über 3–5 Szenen: alle Szenen
  tragen dieselben `bars`, `show` zählt 1, 2, 3 … hoch, der neue Balken wächst, wenn seine Zahl gesprochen wird. Mit `limit`
  eine Grenzlinie, die der letzte Balken durchbricht („Ein Tag hat 24 h“). Diese Szenen dürfen direkt aufeinander folgen.
- **Schlüsselwort:** Das Bild zoomt auf die letzte Zahl des Satzes (bei statements auf das erste markierte Wort). Deshalb:
  **eine wichtige Zahl pro Satz, möglichst am Ende.** Soll es ein anderes Wort sein: `"key": "<Wortanfang>"` in der Szene.
- `"hold": 0.25` (höchstens 0.5) an einer Szene = Atempause danach. Nur nach dem Hook-Paar (Szene 2) und nach dem Höhepunkt,
  zusammen höchstens 1 Sekunde.
- **Schleife (Pflicht):** Die letzte Szene ist ein kurzer `statement`-Satz, der mit Doppelpunkt endet und in den ersten Satz
  zurückführt („Und denk dran:“, „Und merk dir:“, „Denn eins bleibt:“). Das Video endet ohne Ausblenden und beginnt sofort neu.
  Lies den letzten und den ersten Satz hintereinander: es muss wie ein Satz klingen. Die Szene davor ist der Schlusssatz
  (eine Aufforderung für heute) als `statement` mit `chip` (Frage für die Kommentare, höchstens 28 Zeichen).
- Ziffern dürfen Ziffern bleiben (die Stimme liest „5:42 Uhr“, „3000“, „0,5 Promille“ richtig). **Nie eine Ziffer direkt vor
  dem Punkt am Satzende** („schon 6.“ wird als „sechste“ gelesen): immer mit Einheit, „schon 6 Stunden.“ Zahlen mit
  Tausenderpunkt ab 10.000 ausschreiben („zehntausendachtzig“) und dann `"cap": "<Satz mit Ziffern>"` setzen, damit die
  Untertitel Ziffern zeigen.
- Ruhig im Inhalt (kein Vorwurf, keine Gesundheitsversprechen), aber im Ton direkt und lebendig. Du-Form.
- **Kein Tod, kein Lebensende (seit 21.11.):** TikTok stufte „360 Tage mit deinen Eltern“ als „sensibles Thema“ ein (nicht für den Für dich-Feed). Nie Sterben, Tod, Lebenserwartung als Endpunkt, „bleiben nur noch“, „mehr nicht“, „wenn deine Eltern 85 werden“. Stattdessen nach vorn rechnen: „In 60 Jahren sind das 720.“, „61 Jahre liegen vor dir.“ Auch Alkohol, Drogen, Glücksspiel, Diäten und psychische Erkrankungen nur nach Rücksprache.
- Nie Regie- oder Gliederungswörter sprechen lassen („Einordnung:“, „Hinweis:“, „Fazit:“). „Klar: Das ist ein Durchschnitt …“
  als kurze Einordnung ist gut.
- Eine Szene mit Einordnung (Durchschnitt, Schätzung, Laborwert …), wenn der Plan unter „Hinweis“ eine verlangt. Reine
  Rechenbeispiele („wenn …“) brauchen keine.

## Grafiken (`graphic.kind`)
counter {to, decimals?, suffix?, unit, chips?} · bars {bars[{label,value,hi?}], unit, decimals?} · grid {total, hi, cols?, label, hiLabel?, gone?}
· ring {percent, center, chips?} · clock {times[], total} · blocks {n (≤ 24), hi?, label (kurz oder ""), caption?}
· timeline {from, to, unit, marks[{at,label}], hiFrom?, hiTo?} · compare {left{value,label}, right{value,label}, hi?}
· chips {items[2–4]{label,value,hi?}} · curve {base, days, marks?, label} · statement {lines[], chip?, invert?} · none
· rise {bars[{label,value}], show, unit, title?, limit?{value,label}} · grid mit `gone` (alle Felder leuchten, `gone` davon gehen aus: Tage, die verstreichen)
- **Kurz halten** (sonst ragt es in die verdeckte Zone): `unit` höchstens ~20 Zeichen, bei `bars` am besten nur `h`, `min`, `%`,
  `Sekunden`; Chip-Texte höchstens ~22 Zeichen; Timeline-Marken nicht dichter als 15 % der Achse und kurze Labels.
- `rise`: Balken-Labels höchstens 11 Zeichen, `title` höchstens ~20, `unit` kurz (`h`, `min`, `%`, `€`), 3–5 Balken.
- Nicht zweimal dieselbe Grafikart direkt hintereinander (Ausnahme: `rise`). `figure.pose`: stand, phone, slump, think, proud, look, none; `place`: left, center, right.

## Prüfen (Pflicht)
```
cd remotion && npm ci --no-audit --no-fund   # einmal
python3 -I scripts/lr/check_spec.py videos/<id>/spec.json          # Länge, statements, Schleife, Ziffern: muss „ok“ melden
node scripts/lr/safezone.mjs videos/<id>/spec.json /tmp/zone-<id>   # muss „all clear“ melden (prüft auch die Untertitel)
```
Meldet `check_spec.py` Probleme, behebe sie und prüfe erneut. Meldet die sichere Zone etwas, Beschriftungen kürzen oder
`statement`-Zeilen verlängern (kurze Zeilen werden riesig) und erneut prüfen. Danach Posttexte nach `POSTTEXTE.md`.
