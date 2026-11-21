#!/bin/bash
# Rennspiel – einen neuen Build zu TestFlight hochladen (auf dem Mac, im Ordner des Repositorys):
#   npm run testflight
# Holt den neuesten Stand, baut die App und lädt sie hoch. Die Build-Nummer ist die Uhrzeit
# (Jahr Monat Tag Stunde Minute, z. B. 2611212115) – so ist sie bei jedem Upload von selbst größer als beim letzten.
set -e
cd "$(dirname "$0")/.."
git checkout main
git pull
npm install
npm run sync
NUMMER=$(date +%y%m%d%H%M)
ARCHIV="$HOME/Library/Developer/Xcode/Archives/Rennspiel.xcarchive"
rm -rf "$ARCHIV"
cd ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIV" -allowProvisioningUpdates CURRENT_PROJECT_VERSION="$NUMMER" archive
xcodebuild -exportArchive -archivePath "$ARCHIV" -exportOptionsPlist ../ExportOptions.plist \
  -exportPath "$HOME/Library/Developer/Xcode/Archives/Rennspiel-export" -allowProvisioningUpdates
echo "Fertig: Build $NUMMER ist hochgeladen."
