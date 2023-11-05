param (
  [string]$file = ""
)

deno run --unstable --allow-env --allow-write --allow-read --allow-ffi $file
