#!/bin/bash
# Rennspiel – einen neuen Build zu TestFlight hochladen (auf dem Mac, im Ordner des Repositorys):
#   npm run testflight
# Holt den neuesten Stand, baut die App und lädt sie hoch. Die Build-Nummer ist die Uhrzeit
# (Jahr Monat Tag Stunde Minute, z. B. 2611212115) – so ist sie bei jedem Upload von selbst größer als beim letzten.
#
# Anmeldung bei Apple: Ohne weitere Angaben nimmt xcodebuild das Konto, das in Xcode angemeldet ist
# (Xcode → Settings → Accounts). Dieses Konto ist für xcodebuild zeitweise nicht sichtbar; dann bricht der
# Upload mit „Failed to Use Accounts“ ab, bis Xcode das Konto wieder bestätigt hat.
# Unabhängig davon geht es mit einem App-Store-Connect-API-Schlüssel. Dafür außerhalb des Repositorys
# die Datei ~/.appstoreconnect/rennspiel.env anlegen (oder die Variablen in der Umgebung setzen):
#   ASC_KEY_ID=…        Schlüssel-ID
#   ASC_ISSUER_ID=…     Issuer-ID
#   ASC_KEY_PATH=…      Pfad zur Datei AuthKey_….p8 (fehlt die Angabe: ~/.appstoreconnect/private_keys/AuthKey_<Schlüssel-ID>.p8)
# Der Schlüssel selbst gehört nie ins Repository.
set -eo pipefail

# Alles steckt in einer Funktion, damit die Shell das ganze Skript gelesen hat, bevor „git pull“ es ändern kann.
hochladen() {
  cd "$(dirname "$0")/.."
  git checkout main
  git pull
  npm install
  npm run sync

  local ANMELDUNG=()
  if [ -f "$HOME/.appstoreconnect/rennspiel.env" ]; then
    # shellcheck disable=SC1091
    . "$HOME/.appstoreconnect/rennspiel.env"
  fi
  if [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ]; then
    local SCHLUESSEL="${ASC_KEY_PATH:-$HOME/.appstoreconnect/private_keys/AuthKey_$ASC_KEY_ID.p8}"
    if [ ! -f "$SCHLUESSEL" ]; then
      echo "FEHLER: API-Schlüssel nicht gefunden: $SCHLUESSEL" >&2
      exit 1
    fi
    ANMELDUNG=(-authenticationKeyPath "$SCHLUESSEL" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
    echo "Anmeldung: App-Store-Connect-API-Schlüssel $ASC_KEY_ID"
  else
    echo "Anmeldung: Konto aus Xcode"
  fi

  local NUMMER ARCHIV PROTOKOLL
  NUMMER=$(date +%y%m%d%H%M)
  ARCHIV="$HOME/Library/Developer/Xcode/Archives/Rennspiel.xcarchive"
  PROTOKOLL=$(mktemp -t rennspiel-upload)
  rm -rf "$ARCHIV"
  cd ios/App
  xcodebuild -project App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIV" -allowProvisioningUpdates "${ANMELDUNG[@]}" CURRENT_PROJECT_VERSION="$NUMMER" archive

  if ! xcodebuild -exportArchive -archivePath "$ARCHIV" -exportOptionsPlist ../ExportOptions.plist \
      -exportPath "$HOME/Library/Developer/Xcode/Archives/Rennspiel-export" -allowProvisioningUpdates \
      "${ANMELDUNG[@]}" 2>&1 | tee "$PROTOKOLL"; then
    echo >&2
    echo "FEHLER: Build $NUMMER ist NICHT hochgeladen." >&2
    if grep -q "Failed to Use Accounts" "$PROTOKOLL"; then
      echo "xcodebuild findet gerade kein Apple-Konto mit Zugriff auf App Store Connect." >&2
      echo "Abhilfe: In Xcode → Settings → Accounts das Konto anklicken (falls verlangt, neu anmelden)," >&2
      echo "dann 'npm run testflight' noch einmal starten. Dauerhaft hilft ein API-Schlüssel (siehe Kopf dieses Skripts)." >&2
    fi
    rm -f "$PROTOKOLL"
    exit 1
  fi
  if ! grep -q "Upload succeeded" "$PROTOKOLL"; then
    rm -f "$PROTOKOLL"
    echo "FEHLER: Im Protokoll fehlt 'Upload succeeded' – Build $NUMMER ist vermutlich nicht hochgeladen." >&2
    exit 1
  fi
  rm -f "$PROTOKOLL"
  echo "Fertig: Build $NUMMER ist hochgeladen."
}

hochladen "$@"
