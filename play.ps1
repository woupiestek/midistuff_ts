param (
  [string]$file = ""
)

deno run --allow-all .\src\writer3.ts $file .\target\temp.mid

Start-Process -FilePath "wmplayer.exe" -ArgumentList .\target\temp.mid

# deno run --unstable-ffi --allow-env --allow-write --allow-read --allow-ffi .\src\player4.ts $file $from $to
