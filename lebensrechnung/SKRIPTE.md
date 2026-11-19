# Skripte schreiben (Lebensrechnung)

Ein Video ist eine Datei `remotion/videos/<id>/spec.json` (Typen: `remotion/src/lr/spec.ts`). `<id>` = dreistellige laufende
Nummer + Kurzname, z. B. `011-buecher`. Beispiele: alle vorhandenen `remotion/videos/*/spec.json`.

## Woher die Inhalte kommen
- Nur aus `lebensrechnung/themen/wochenplan-*.md`: Hook, Kernaussage, Zahlen mit Quellen, Bildideen, Schlusssatz, Hinweise.
  Keine eigenen Zahlen, keine Recherche. Was im Plan als (a) Rechnung steht, als Annahme mit „wenn“ formulieren.
- Welche Themen schon verbraucht sind, steht in `lebensrechnung/themen/verbraucht.json` (Arbeitstitel → id). Nimm die nächsten
  unverbrauchten Themen in der Reihenfolge des Plans; A-Themen auf 12:30, B-Themen auf 19:00, wenn möglich.
- Gehen die unverbrauchten Themen zur Neige (weniger als 4), schreibe trotzdem, was geht, und melde es (siehe Routine).

## Aufbau
- 9 Szenen. Szene 1 = Hook als `statement` (ohne Überschrift), letzte Szene = Schlusssatz als `statement` mit `chip` (kurze Frage).
- Sprechtext gesamt **830–920 Zeichen** (≈ 60 s). Pro Szene 1–3 kurze Sätze. Ruhig, Du-Form, kein Vorwurf, keine Gesundheitsversprechen.
- Zahlen, die die Stimme falsch lesen könnte, im `vo` ausschreiben: Tausender mit Punkt („8.800“ → „achttausendachthundert“),
  Uhrzeiten („5:42“ → „fünf Uhr zweiundvierzig“), Promille („0,5“ → „null Komma fünf“), „37-Fachen“ → „Siebenunddreißigfachen“.
  Einfache Zahlen (47, 2012, 75) und Kommazahlen wie 1,35 dürfen Ziffern bleiben.
- Nie Regie- oder Gliederungswörter sprechen lassen („Einordnung:“, „Hinweis:“, „Fazit:“, „Das ist ein Durchschnitt von 2022:“). Jeder Satz muss natürlich gesprochen klingen.
- Eine Szene mit „Einordnung“ (Durchschnitt, Schätzung, Laborwert …), wie im Plan unter „Hinweis“ verlangt.

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
Muss „all clear“ melden. Sonst Beschriftungen kürzen und erneut prüfen. Zeichenzahl prüfen. Danach Posttexte nach `POSTTEXTE.md`.
