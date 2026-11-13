# Serves a prebuilt site folder on 127.0.0.1 at a fixed port (app/web-hosting R7, R4). Needs only the Windows PowerShell that ships with Windows 10 and 11.
param(
  [Parameter(Mandatory = $true)][string]$Site,
  [Parameter(Mandatory = $true)][int]$Port,
  [switch]$NoBrowser
)

if (-not (Test-Path -LiteralPath $Site -PathType Container)) {
  Write-Host 'The site folder was not found. Build it first (npm run build:all) or use the release package.'
  exit 1
}
$root = (Resolve-Path -LiteralPath $Site).Path.TrimEnd('\')

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript'; '.mjs' = 'text/javascript'; '.json' = 'application/json'; '.css' = 'text/css'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.wasm' = 'application/wasm'
  '.zip' = 'application/zip'; '.hdr' = 'application/octet-stream'; '.bin' = 'application/octet-stream'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
try {
  $listener.Start()
} catch {
  Write-Host "Port $Port is busy. The projects you saved live under this port, so the app cannot use another one. Close whatever is using port $Port and start again."
  exit 2
}

Write-Host "Serving $root at http://127.0.0.1:$Port/ - close this window to stop."
if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$Port/" }

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $response = $context.Response
  try {
    $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart('/')
    if ($relative -eq '') { $relative = 'index.html' }
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
    if (-not $full.StartsWith($root + '\') -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $response.StatusCode = 404
    } else {
      $type = $types[[System.IO.Path]::GetExtension($full).ToLowerInvariant()]
      if ($null -eq $type) { $type = 'application/octet-stream' }
      $response.ContentType = $type
      $stream = [System.IO.File]::OpenRead($full)
      try {
        $response.ContentLength64 = $stream.Length
        $stream.CopyTo($response.OutputStream)
      } finally {
        $stream.Dispose()
      }
    }
  } catch {
    try { $response.StatusCode = 404 } catch { }
  } finally {
    try { $response.Close() } catch { }
  }
}
