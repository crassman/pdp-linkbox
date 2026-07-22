# PDP Linkbox

Ein Tampermonkey User-Script zur Erweiterung der Otto PDPs (Product Detail Pages) um nützliche Tools und Direktlinks.


## Voraussetzungen

Bevor du die Linkbox installierst, stelle sicher, dass du die Erweiterung Tampermonkey in deinem Browser installiert hast.

* Chrome / Edge / Brave: https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo
* Firefox: https://addons.mozilla.org/de/firefox/addon/tampermonkey/


## Einmalige Einrichtung und Installation (Beispiel Chrome)

Hinweis für bestehende Nutzer: Wenn du bereits eine ältere Version der Linkbox installiert hattest, führe bitte Schritt 2 durch, um alte Rückstände zu entfernen.

1. Tampermonkey Plugin installieren: 
   Installiere das Tampermonkey-Browser-Plugin über den oben genannten Link für deinen Browser.

2. (Optional) Alte Version löschen: 
   Falls du die Linkbox bereits installiert hattest: Klicke auf das Tampermonkey-Icon im Browser -> Übersicht -> Alte "pdp.linkbox" löschen.

3. Entwicklermodus aktivieren: 
   Öffne in Chrome die Erweiterungsverwaltung: chrome://extensions (oder über das Menü: Erweiterungen -> Erweiterungen verwalten).
   Aktiviere oben rechts den Schalter "Entwicklermodus".

4. Nutzerscripts zulassen: 
   Klicke in der Erweiterungsverwaltung bei Tampermonkey auf "Details".
   Aktiviere die Option "Nutzerscripts zulassen".

5. PDP Linkbox installieren: 
   Öffne den folgenden Link, um das Skript direkt in Tampermonkey zu installieren:

   https://raw.githubusercontent.com/crassman/pdp-linkbox/main/pdp.linkbox.user.js

   Klicke auf der sich öffnenden Seite auf den Button "Installieren" bzw. "Neu installieren".

6. Domain-Freigabe auf otto.de: 
   Rufe eine beliebige Produktdetailseite auf otto.de/p/* auf.
   Wenn Tampermonkey nach Berechtigungen fragt, klicke auf "Diese Domain immer zulassen".

---

## Updates

Das Skript aktualisiert sich automatisch über GitHub. Du musst nach der Ersteinrichtung nichts weiter tun. Stelle im Zweifel nur sicher, dass automatische Updates erlaubt sind.

---

## Kontakt und Support

Bei Fragen, Bugs oder Feature-Wünschen:
* Autor: Christian Raßmann (christian.rassmann@otto.de)
* Issues: https://github.com/crassman/pdp-linkbox/issues
