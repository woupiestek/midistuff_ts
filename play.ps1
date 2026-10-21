param (
  [string]$file = ""
)

if (-not (Test-Path .\target)) {
  New-Item -ItemType Directory .\target | Out-Null
}

bun run .\src\writer3.ts $file .\target\temp.mid
bun run .\src\render_wav.ts $file .\target\temp.wav

$wav = (Resolve-Path .\target\temp.wav).Path
(New-Object Media.SoundPlayer $wav).PlaySync()
