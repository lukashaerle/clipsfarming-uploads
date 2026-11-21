# Skripte schreiben (Lebensrechnung)

Ein Video ist eine Datei `remotion/videos/<id>/spec.json` (Typen: `remotion/src/lr/spec.ts`). `<id>` = dreistellige laufende
Nummer + Kurzname, z. B. `011-buecher`. Beispiele: alle vorhandenen `remotion/videos/*/spec.json`.

## Woher die Inhalte kommen
- Nur aus `lebensrechnung/themen/wochenplan-*.md`: Hook, Kernaussage, Zahlen mit Quellen, Bildideen, Schlusssatz, Hinweise.
  Keine eigenen Zahlen, keine Recherche. Was im Plan als (a) Rechnung steht, als Annahme mit „wenn“ formulieren.
- Welche Themen schon verbraucht sind, steht in `lebensrechnung/themen/verbraucht.json` (Arbeitstitel → id). Nimm die nächsten
  unverbrauchten Themen in der Reihenfolge des Plans; A-Themen auf 12:30, B-Themen auf 19:00, wenn möglich.
- Gehen die unverbrauchten Themen zur Neige (weniger als 4), schreibe trotzdem, was geht, und melde es (siehe Routine).

## Aufbau (Action-Stil, seit 19.11.2026 Standard)
- Spec beginnt mit `"style": "action"`. Beispiele: `remotion/videos/006-mit-19` bis `012-720-buecher`.
- **14–16 Szenen**, jede mit **einem kurzen Satz** (höchstens ~70 Zeichen, gern Frage + Antwort, „Von wegen.“, „Klar: …“).
  Sprechtext gesamt **600–820 Zeichen** (≈ 40–50 s nach dem Tempo-Aufschlag).
- Szene 1 = Hook als Frage oder Behauptung, `statement` ohne Überschrift, packend: das Bild in Szene 1 ist zugleich das
  Vorschaubild. **Hook-Test (seit 19.11.):** jedes Skript bekommt einen von vier Hook-Typen, im Wechsel, so dass jeder Typ etwa
  gleich oft vorkommt (Zählung in `lebensrechnung/hooks.json`, dort die neue id mit Typ eintragen):
  `frage` („Wie oft siehst du deine Eltern noch?“), `zahl` (Schockzahl zuerst: „Aufschieben kostet heute nur 2 Minuten.“),
  `mythos` (verbreiteter Irrtum, sofort widerlegt: „21 Tage, dann sitzt die Gewohnheit?“ → „Leider nein.“),
  `szene` (Mini-Szene, die man vor sich sieht: „Sie hat keinen Tropfen getrunken.“). Steht in `hooks.json` unter `"bevorzugt"`
  ein Typ (von der Tagesauswertung gesetzt), nimm diesen bei jedem zweiten Skript. Szene 2 löst sofort auf („Von wegen. …“, „Leider nein. …“). Letzte Szene = Schlusssatz als `statement` mit `chip`.
- Zwischendurch 2–3 kurze `statement`-Szenen als Ausrufe („Fast *2 Jahre.*“, „Nie eine *Studie.*“), sonst wechselnde Grafiken.
- Ziffern dürfen Ziffern bleiben (die Stimme liest „5:42 Uhr“, „3000“, „0,5 Promille“ richtig, die Untertitel zeigen Ziffern).
  Nur Zahlen mit Tausenderpunkt ab 10.000 ausschreiben („zehntausendachtzig“) und dann `"cap": "<Satz mit Ziffern>"` setzen,
  damit die Untertitel Ziffern zeigen.
- Ruhig im Inhalt (kein Vorwurf, keine Gesundheitsversprechen), aber im Ton direkt und lebendig. Du-Form.
- **Kein Tod, kein Lebensende (seit 21.11.):** TikTok stufte „360 Tage mit deinen Eltern“ als „sensibles Thema“ ein (nicht für den Für dich-Feed). Nie Sterben, Tod, Lebenserwartung als Endpunkt, „bleiben nur noch“, „mehr nicht“, „wenn deine Eltern 85 werden“. Stattdessen nach vorn rechnen: „In 60 Jahren sind das 720.“, „61 Jahre liegen vor dir.“ Auch Alkohol, Drogen, Glücksspiel, Diäten und psychische Erkrankungen nur nach Rücksprache.
- Nie Regie- oder Gliederungswörter sprechen lassen („Einordnung:“, „Hinweis:“, „Fazit:“). „Klar: Das ist ein Durchschnitt …“
  als kurze Einordnung ist gut.
- Eine Szene mit Einordnung (Durchschnitt, Schätzung, Laborwert …), wie im Plan unter „Hinweis“ verlangt.

## Überschriften (`head`)
- Zwei Zeilen mit `|`, je höchstens ~16 Zeichen. `*Wort*` = helles Schlüsselwort; das schließende `*` muss direkt am Wortende
  stehen, Satzzeichen gehören hinein: `*nichts.*`, nicht `*nichts*.` und nie `*50*,`.
- `""` für Szenen mit `statement`.

## Grafiken (`graphic.kind`)
counter {to, decimals?, suffix?, unit, chips?} · bars {bars[{label,value,hi?}], unit, decimals?} · grid {total, hi, cols?, label, hiLabel?}
· ring {percent, center, chips?} · clock {times[], total} · blocks {n (≤ 24), hi?, label (kurz oder ""), caption?}
· timeline {from, to, unit, marks[{at,label}], hiFrom?, hiTo?} · compare {left{value,label}, right{value,label}, hi?}
· chips {items[2–4]{label,value,hi?}} · curve {base, days, marks?, label} · statement {lines[], chip?} · none
- **Kurz halten** (sonst ragt es in die verdeckte Zone): `unit` höchstens ~20 Zeichen, bei `bars` am besten nur `h`, `min`, `%`,
  `Sekunden`; Chip-Texte höchstens ~22 Zeichen; Timeline-Marken nicht dichter als 15 % der Achse und kurze Labels.
- Nicht zweimal dieselbe Grafikart direkt hintereinander. `figure.pose`: stand, phone, slump, think, proud, look, none; `place`: left, center, right.

## Prüfen (Pflicht)
```
cd remotion && npm ci --no-audit --no-fund   # einmal
node scripts/lr/safezone.mjs videos/<id>/spec.json /tmp/zone-<id>
```
Muss „all clear“ melden (prüft auch die Untertitel). Sonst Beschriftungen kürzen oder `statement`-Zeilen verlängern (kurze Zeilen werden riesig) und erneut prüfen. Zeichenzahl prüfen. Danach Posttexte nach `POSTTEXTE.md`.
