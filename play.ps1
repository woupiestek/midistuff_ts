param (
  [string]$file = "",
  [int]$from = 0,
  [int]$to = 1000
)

deno run --unstable-ffi --allow-env --allow-write --allow-read --allow-ffi .\src\player3.ts $file $from $to
