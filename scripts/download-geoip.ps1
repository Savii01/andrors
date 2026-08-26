# PowerShell script to download MaxMind GeoLite2 database

Write-Host "=== MaxMind GeoLite2 Database Setup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To use this script, you need:"
Write-Host "1. Register at https://www.maxmind.com/en/geolite2/signup"
Write-Host "2. Get your license key from your account"
Write-Host "3. Set MAXMIND_LICENSE_KEY environment variable"
Write-Host ""

$licenseKey = $env:MAXMIND_LICENSE_KEY

if (-not $licenseKey) {
    Write-Host "ERROR: MAXMIND_LICENSE_KEY environment variable not set" -ForegroundColor Red
    exit 1
}

# Create data directory if it doesn't exist
if (-not (Test-Path "data")) {
    New-Item -ItemType Directory -Path "data" | Out-Null
}

# Download GeoLite2-City database
Write-Host "Downloading GeoLite2-City database..." -ForegroundColor Yellow
$url = "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=$licenseKey&suffix=tar.gz"
$outputPath = "data/GeoLite2-City.tar.gz"

try {
    Invoke-WebRequest -Uri $url -OutFile $outputPath
    Write-Host "Download complete. Extracting..." -ForegroundColor Yellow
    
    tar -xzf $outputPath -C data --strip-components=1 --wildcards "*.mmdb"
    
    Remove-Item $outputPath
    
    Write-Host "GeoLite2-City.mmdb successfully installed to data/" -ForegroundColor Green
}
catch {
    Write-Host "Download failed. Check your license key." -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

Write-Host ""
Write-Host "Setup complete! The database is ready to use." -ForegroundColor Green
