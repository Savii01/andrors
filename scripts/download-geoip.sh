#!/bin/bash

# Script to download MaxMind GeoLite2 database
# You need to register at https://www.maxmind.com/en/geolite2/signup
# and get your license key

echo "=== MaxMind GeoLite2 Database Setup ==="
echo ""
echo "To use this script, you need:"
echo "1. Register at https://www.maxmind.com/en/geolite2/signup"
echo "2. Get your license key from your account"
echo "3. Set MAXMIND_LICENSE_KEY environment variable"
echo ""

if [ -z "$MAXMIND_LICENSE_KEY" ]; then
    echo "ERROR: MAXMIND_LICENSE_KEY environment variable not set"
    echo "Usage: MAXMIND_LICENSE_KEY=your_key ./scripts/download-geoip.sh"
    exit 1
fi

# Create data directory if it doesn't exist
mkdir -p data

# Download GeoLite2-City database
echo "Downloading GeoLite2-City database..."
curl -o data/GeoLite2-City.tar.gz \
    "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz"

if [ $? -eq 0 ]; then
    echo "Download complete. Extracting..."
    
    # Extract the .mmdb file
    tar -xzf data/GeoLite2-City.tar.gz -C data --strip-components=1 --wildcards "*.mmdb"
    
    # Clean up tar file
    rm data/GeoLite2-City.tar.gz
    
    echo "✓ GeoLite2-City.mmdb successfully installed to data/"
else
    echo "✗ Download failed. Check your license key."
    exit 1
fi

echo ""
echo "Setup complete! The database is ready to use."
