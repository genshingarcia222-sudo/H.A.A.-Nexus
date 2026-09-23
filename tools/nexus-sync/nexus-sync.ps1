<#
.SYNOPSIS
  Windows entry point for the H.A.A. Nexus distributed-workstation sync tool.

.DESCRIPTION
  Delegates to tools/nexus-sync/nexus-sync.mjs, which holds the single
  implementation (see .nexus/DECISIONS.md N-005). It never force-pushes, resets,
  cleans, rebases or discards anything.

.EXAMPLE
  .\tools\nexus-sync\nexus-sync.ps1 start
  .\tools\nexus-sync\nexus-sync.ps1 claim --task-id P8-D8 --name "Resolve D8"
  .\tools\nexus-sync\nexus-sync.ps1 finalize --shutdown
#>
$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'nexus-sync needs Node.js >= 20 on PATH (the repository already requires it).'
    exit 2
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error 'nexus-sync needs git on PATH.'
    exit 2
}

$script = Join-Path $PSScriptRoot 'nexus-sync.mjs'
& node $script @args
exit $LASTEXITCODE
