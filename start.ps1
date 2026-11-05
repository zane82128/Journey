param([int]$Port = 5174)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
    $calendarNode = $nodeCommand.Source
} else {
    $runtimeRoot = Join-Path $env:LOCALAPPDATA 'OpenAI/Codex/runtimes/cua_node'
    $calendarNode = Get-ChildItem -Path "$runtimeRoot/*/bin/node.exe" -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $calendarNode) { throw 'Node.js 22+ is required. Install Node.js, then run this script again.' }
& $calendarNode tools/build.mjs
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
$env:PORT = "$Port"
Write-Host "Open http://127.0.0.1:$Port/ in your browser. Press Ctrl+C to stop."
& $calendarNode tools/preview.mjs
