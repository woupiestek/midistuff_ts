param (
  [string]$file = ""
)

if (-not (Test-Path .\target)) {
  New-Item -ItemType Directory .\target | Out-Null
}

deno run --allow-read --allow-write .\src\writer3.ts $file .\target\temp.mid
deno run --allow-read --allow-write .\src\render_wav.ts $file .\target\temp.wav

$wav = (Resolve-Path .\target\temp.wav).Path
(New-Object Media.SoundPlayer $wav).PlaySync()
