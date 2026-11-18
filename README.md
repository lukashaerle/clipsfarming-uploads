# clipsfarming-uploads

Übergabe-Repository für CLIPSFARMING (getrennt von Faktenfabrik).

- `tools/make_clip.py` – macht aus einem Quellvideo einen 1080x1920-Clip mit Wort-für-Wort-Untertiteln, optionalem Hook und Text oben. Kein Wasserzeichen, keine Musik.
- `clips/` bzw. `cod/` – fertige Clips. vidIQ holt sie über `https://raw.githubusercontent.com/lukashaerle/clipsfarming-uploads/main/<pfad>` ab.

Einrichtung in einer frischen Umgebung:
```
pip install --break-system-packages -q -U "yt-dlp[default]" faster-whisper numpy
```

## remotion/

Das Remotion-Projekt der animierten Erklärvideos (Pilot „5 Stunden am Handy“, Komposition `Handy5hSW`), damit die Videos auch in der Cloud gerendert werden können. Die Schrift (Barlow Condensed, SIL Open Font License) liegt in `remotion/public/fonts/`. Einmaliger Cloud-Test: `bash remotion/scripts/cloud_test.sh`.
