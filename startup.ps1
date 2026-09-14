# Windows companion to startup.sh; source is mirrored into the existing local runtime.
# Starts npm run dev, keeps its output hidden, and returns without blocking.
$taskRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
try {
  $taskResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:8080/' -TimeoutSec 2
  if ($taskResponse.StatusCode -eq 200) {
    & node (Join-Path $taskRoot 'scripts/start-local.mjs') --sync-only
    exit 0
  }
} catch { }
Start-Process -FilePath (Get-Command node).Source -ArgumentList @('scripts/start-local.mjs') -WorkingDirectory $taskRoot -WindowStyle Hidden
