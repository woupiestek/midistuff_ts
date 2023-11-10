param (
  [string]$source = "",
  [string]$target = ""
)

deno run --allow-write --allow-read .\src\writer3.ts $source $target
