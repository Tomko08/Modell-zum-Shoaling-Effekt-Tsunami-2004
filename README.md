# Shoaling Lab

Interaktive Browseranimation zum Shoaling-Effekt eines Tsunamis. Ein schematischer Querschnitt zeigt eine Welle auf ihrem Weg vom offenen Ozean in flacheres Wasser: Sie wird langsamer, kürzer und höher.

Zusätzlich vergleicht `vergleich.html` zwei unabhängig steuerbare Wellen vor **Banda Aceh** und vor **Sri Lankas Ostküste bei Kalmunai**. Die ursprüngliche Einzelwellenanimation bleibt unter `index.html` erhalten.

## Küstenvergleich

Nach dem Start des Entwicklungsservers `/vergleich.html` öffnen. Beide Querschnitte verwenden dieselben Maßstäbe. Jede Welle kann einzeln gestartet, pausiert, zurückgesetzt und über ihre Zeitleiste untersucht werden. Im regionalen Modus sind Eingangshöhe und Periode unabhängig einstellbar; im Modus mit gleichen Eingangswellen werden die Regler gekoppelt. Die Schaltfläche „An der Küste vergleichen“ setzt beide Wellen an ihren 20-m-Endpunkt. Der gemeinsame Zeitraffer beträgt 45×, 90× oder 180×, während die Uhren unabhängig steuerbar bleiben.

- **Regionaler Vergleich:** Beispielhaft stärkere Eingangswelle bei Banda Aceh (3 m), kleinere bei Sri Lanka (1,5 m).
- **Gleiche Eingangswelle:** Jeweils 2 m, um die angenommene lokale Küstengeometrie getrennt von der Eingangswellenhöhe zu untersuchen.
- **Küstengeometrie:** Der zusätzliche Einfluss eines sich verengenden beziehungsweise verbreiternden Wellenbündels kann ein- und ausgeschaltet werden.

### Vergleichsmodell und Aussagegrenzen

Beide Modellstrecken sind 120 km lang und führen von 2.000 m zu 20 m Wassertiefe. Die Standardperiode beträgt 20 Minuten. Die beiden schematischen Tiefenprofile zeigen unterschiedliche Verläufe der Abflachung. Geschwindigkeit und Wellenlänge folgen weiterhin `c = sqrt(g * h)` und `lambda = c * T`.

Das Green’sche Gesetz wird um die relative effektive Breite `b` eines Wellenbündels erweitert:

```text
H = H0 * (h0 / h)^(1/4) * sqrt(b0 / b)
```

`H` bezeichnet die Wellenhöhe zwischen Tal und Berg. Offshore gilt `b0 = 1`. Die illustrativen Endwerte sind `b = 0,65` bei Banda Aceh und `b = 1,25` bei Sri Lanka: Eine Bündelung erhöht die Wellenhöhe, eine Aufweitung verringert sie. Die angenommene Bündelbreite ist kein gemessener Küstenparameter; sie ersetzt weder ein zweidimensionales Refraktionsmodell noch reale Bathymetriedaten. Die Beziehung erhält näherungsweise den Energiefluss `H² * c * b`.

| Modellszenario bei 20 m Wassertiefe | Banda Aceh | Sri Lanka |
| --- | ---: | ---: |
| Regionale Eingangswellen mit Küstengeometrie | 11,77 m | 4,24 m |
| Gleiche Eingangswelle mit Küstengeometrie | 7,84 m | 5,66 m |
| Gleiche Eingangswelle ohne Küstengeometrie | 6,32 m | 6,32 m |

**Diese Zahlen sind Modellwerte, keine Messwerte des Tsunamis 2004.** Unterschiedliche Hangprofile verändern in diesem Modell den Ort und den zeitlichen Verlauf des Shoalings. Bei gleichen Anfangs- und Endtiefen sowie gleicher Eingangswelle ergibt das reine Green’sche Gesetz jedoch dieselbe Endhöhe. Der Unterschied der regionalen Beispielwerte entsteht ausdrücklich aus der gewählten Eingangswelle und dem angenommenen geometrischen Effekt.

Der Vergleich ist ein historisch orientiertes, didaktisches Szenario. Die Ausrichtung und Nähe zur Tsunamiquelle, die tatsächliche Bathymetrie, Welleninterferenz und lokale Küstenformen trugen 2004 zu stark variierenden Auswirkungen bei. Eine stärkere Eingangswelle lässt sich deshalb nicht allein durch lokalen Shoaling erklären. Kalmunai steht hier für einen ausgewählten Vergleichsabschnitt, nicht für die gesamte Küste Sri Lankas. Die gezeichneten Profile, Bündelbreiten und Eingangshöhen sind nicht aus verifizierten Messdaten von 2004 rekonstruiert.

Die Wellen werden nur bis 20 m Wassertiefe verfolgt. Auflaufen an Land, Wellenbrechen, Reibung, Reflexion und Überflutung werden nicht berechnet. Insbesondere ist die angezeigte Wellenhöhe keine **Auflaufhöhe (Run-up)** über dem Meeresspiegel. Bei `H / h > 0,2` weist die Oberfläche auf die Grenzen der linearen Näherung hin; dies ist kein berechnetes Brechkriterium. Die Modellreisezeit bezieht sich allein auf die lokale 120-km-Strecke und ist keine Ankunftszeit seit dem Erdbeben.

Das Green’sche Gesetz setzt langsam variierende Tiefe und Bündelbreite voraus. Bei schnellen Profiländerungen und langen Wellen bleibt die Darstellung qualitativ. Die Bündelbreiten werden vorgegeben, nicht aus der Küstenform berechnet.

Für eine quantitative historische Rekonstruktion wären georeferenzierte Tiefen- und Geländedaten, eine Erdbebenquelle und ein nichtlineares Flachwassermodell nötig. Die [GeoClaw-Dokumentation](https://www.clawpack.org/geoclaw.html) beschreibt einen solchen Ansatz und [Tsunami-Datensätze](https://www.clawpack.org/tsunamidata.html) die benötigten Eingaben. Weiterführende Feldstudien: [Borrero (2005), Banda Aceh](https://doi.org/10.1785/gssrl.76.3.312) und [Liu et al. (2005), Sri Lanka](https://doi.org/10.1126/science.1110730). Die Studien dienen als Literaturhinweise; ihre Messdaten wurden nicht zur Kalibrierung dieser Animation verwendet.

## Einzeldatei zum Teilen

### Vorbereitung für GitHub Pages

Der Küstenvergleich liegt zusätzlich unter `docs/index.html`; `docs/.nojekyll` kennzeichnet die fertige statische Seite. Beide Dateien sind lokal für GitHub Pages vorbereitet. Diese Vorbereitung veröffentlicht noch keine Website.

Nach einer ausdrücklich beauftragten Veröffentlichung kann GitHub Pages den Ordner `/docs` auf dem veröffentlichten Branch bereitstellen. Die Seite enthält sämtliche Skripte und Styles und benötigt keinen Build auf GitHub.

Bei späteren Modelländerungen die Veröffentlichungsdatei vor einem neuen Release aktualisieren:

```sh
npm run export
cp dist/kuestenvergleich.html docs/index.html
```

Die Cloud-Einrichtung erzeugt nur die Exporte unter `dist`; sie überschreibt diese Veröffentlichungsdatei nicht automatisch.

### Eigenständige HTML-Dateien

`dist/shoaling-animation.html` enthält die gesamte Animation inklusive Gestaltung und Skripten in einer HTML-Datei. Du kannst sie herunterladen, weitergeben und im Browser öffnen. Sie benötigt keine externen Ressourcen.

`dist/kuestenvergleich.html` enthält den neuen Küstenvergleich ebenfalls als eigenständige, offline nutzbare HTML-Datei. Der Export erzeugt beide Varianten.

Nach Änderungen an den Quelldateien lässt sie sich erneut erzeugen:

```sh
npm run export
```

## Starten

Voraussetzung: Node.js ab Version 20. Externe Pakete werden nicht benötigt.

```sh
cd /workspace/Modell-zum-Shoaling-Effekt-Tsunami-2004
npm run dev
```

Der Terminal zeigt die lokale Browseradresse an. Der Entwicklungsserver verwendet standardmäßig Port 3000 und bindet an `127.0.0.1`. Mit `PORT=3001 npm run dev` kann ein anderer Port verwendet werden. `HOST` lässt sich bei Bedarf ebenfalls setzen.

## Bedienung

- **Start / Weiter:** Die Animation starten beziehungsweise fortsetzen.
- **Pause:** Die Welle anhalten und ihre aktuellen Werte untersuchen.
- **Neustart:** Zum Anfang zurückkehren und pausieren. Die gewählten Modellparameter bleiben erhalten.
- **Zeitleiste:** Zu einer Stelle der Modellreise springen; die Animation pausiert dabei.
- **Wellenhöhe:** Die Ausgangshöhe in der Tiefsee zwischen 0,5 und 4 Metern einstellen.
- **Wellenperiode:** Den zeitlichen Abstand zwischen Wellenbergen zwischen 10 und 30 Minuten einstellen.
- **Animationstempo:** Langsam, normal oder schnell. Die vollständige Reise dauert 80, 40 beziehungsweise 20 Sekunden.
- **Tastatur:** Tab erreicht alle Bedienelemente, Pfeiltasten bedienen die Regler. Außerhalb eines Bedienelements startet beziehungsweise pausiert die Leertaste die Animation.

Die Animation beginnt pausiert, funktioniert auf schmalen Bildschirmen und pausiert beim Wechsel in einen anderen Browser-Tab. Nach Erreichen des Endpunkts lässt sie sich erneut starten.

## Das physikalische Modell

Alle Berechnungen verwenden SI-Einheiten. Die Oberfläche zeigt Geschwindigkeit in km/h, Wellenlänge in km und Wellenhöhe und Wassertiefe in m.

| Größe | Vereinfachte Beziehung |
| --- | --- |
| Ausbreitungsgeschwindigkeit | `c = sqrt(g * h)` |
| Wellenlänge | `lambda = c * T` |
| Amplitude nach dem Green’schen Gesetz | `A = A0 * (h0 / h)^(1/4)` |
| Wellenhöhe | `H = 2 * A` |

`g = 9,81 m/s²`, `h` ist die lokale Wassertiefe und `T` die konstante Periode. Ein glattes schematisches Profil verbindet 4.000 m Tiefseetiefe mit 20 m Tiefe am Küstenendpunkt über 300 km. Die Reisezeit entsteht aus der numerischen Integration von `ds / c(h)`; dadurch bewegt sich der verfolgte Wellenberg im flachen Wasser tatsächlich langsamer. Die Wellenphase folgt denselben Reisezeiten, sodass sich der Wellenzug räumlich komprimiert.

Bei den Standardeinstellungen (H₀ = 2 m, T = 20 min) beträgt die Modellreise rund 63,3 Minuten:

| Modellwert | Tiefsee, 4.000 m | Küstenendpunkt, 20 m |
| --- | ---: | ---: |
| Geschwindigkeit | 713 km/h | 50 km/h |
| Wellenlänge | 237,7 km | 16,8 km |
| Wellenhöhe | 2,00 m | 7,52 m |

Wellenhöhe und Tiefenprofil sind grafisch überzeichnet; die vertikalen Maßstäbe sind unabhängig. Die Kennzahlen verwenden die physikalischen Modellwerte. Die Hüllkurve hebt einen Wellenberg und die angrenzenden Täler hervor. Der Wellenlängenpfeil zeigt die lokale Wellenlänge auf dem horizontalen 300-km-Maßstab; übersteigt sie die Modellstrecke, erscheint ein Hinweis anstelle des Pfeils.

Das Modell setzt eine lineare, reibungsfreie Flachwasserwelle ohne Reflexion voraus. Reibung, Wellenbrechen, Überflutung, Küstengeometrie und die Entstehung des Tsunamis sind nicht modelliert. Bei großen Wellen im flachen Wasser ist die Näherung eingeschränkt; die Oberfläche weist bei `H / h > 0,5` zusätzlich darauf hin. Dieser Schwellenwert ist ein didaktischer Hinweis, kein berechnetes Brechkriterium. Der Shoaling-Effekt ist auch für den Tsunami im Indischen Ozean 2004 relevant; die Animation rekonstruiert keine historischen Messdaten.

## Prüfen

```sh
npm run check
npm test
```

Die sechs Einzelwellentests prüfen die Modellgrenzen, das erwartete Shoaling-Verhalten, den näherungsweise erhaltenen Energiefluss `A²c`, Reisezeit und inverse Position, die Integration bei konstanter Tiefe und ihre Konvergenz sowie die Parameterprüfung. Sieben zusätzliche Tests prüfen die regionalen Tiefenprofile, die Trennung von Shoaling und Geometrie, den Energiefluss `H²cb`, die Eingangswellenmodi, lokale Reisezeiten und ungültige Parameter. Es ist kein Installationsschritt erforderlich.

Zusätzlich wurde die Oberfläche in Chromium auf Desktop und Mobilansicht geprüft: Start, Pause, Neustart, Zeitleiste, Parameteränderungen, Tempo, Tastatursteuerung, automatisches Ende und erneuter Start. Browserfehler wurden dabei erfasst.

## Dateien

- `index.html`: deutsche Oberfläche und Modellbeschreibung.
- `styles.css`: responsive Gestaltung.
- `physics.js`: eigenständig testbares physikalisches Modell.
- `app.js`: Canvas-Zeichnung, Zeitraffer und Bedienelemente.
- `vergleich.html`: deutsche Oberfläche mit zwei unabhängigen Wellen und Modellbeschreibung.
- `comparison.css`: responsive Gestaltung des Küstenvergleichs.
- `comparison.js`: Darstellung und Steuerung der beiden regionalen Wellen.
- `regional-physics.js`: schematische Regionalprofile, Bündelbreiten und testbare Modellberechnungen.
- `scripts/serve.mjs`: Entwicklungsserver ohne externe Abhängigkeiten.
- `scripts/export.mjs`: erstellt beide eigenständigen HTML-Dateien aus den Quelldateien.
- `tests/physics.test.cjs`: Modelltests mit dem eingebauten Node-Testläufer.
- `tests/regional-physics.test.cjs`: Modelltests des Küstenvergleichs.

Für Cloud-Aufgaben den vorhandenen Checkout verwenden. Jede Aufgabe läuft bereits in einer isolierten Umgebung; ein zusätzlicher Git-Worktree ist für diesen Ablauf nicht erforderlich.
