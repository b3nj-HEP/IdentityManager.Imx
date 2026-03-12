# Set $ErrorActionPreference to 'Stop' to stop execution on any error
$ErrorActionPreference = 'Stop'

npm run build:production qer-app-portal

# zip all folders content in dist directory into each zip file (name prefixed with 'Html_')
Get-ChildItem -Path "dist" -Directory | ForEach-Object { Compress-Archive -Path "$($_.FullName)/*" -DestinationPath "dist/Html_$($_.Name).zip" }