#!/bin/bash
# Assess existing infrastructure on the Droplet

echo "=== Checking Docker containers ==="
docker ps -a

echo ""
echo "=== Checking Docker networks ==="
docker network ls

echo ""
echo "=== Checking nginx configuration ==="
if [ -d /etc/nginx/sites-enabled ]; then
    echo "Sites enabled:"
    ls -la /etc/nginx/sites-enabled/
    echo ""
    echo "Site configs:"
    for f in /etc/nginx/sites-enabled/*; do
        echo "--- $f ---"
        cat "$f"
        echo ""
    done
elif [ -d /etc/nginx/conf.d ]; then
    echo "Conf.d directory:"
    ls -la /etc/nginx/conf.d/
    for f in /etc/nginx/conf.d/*; do
        echo "--- $f ---"
        cat "$f"
        echo ""
    done
fi

echo ""
echo "=== Checking main nginx.conf ==="
cat /etc/nginx/nginx.conf

echo ""
echo "=== Checking if certbot is installed ==="
which certbot || echo "certbot not found"

echo ""
echo "=== Checking existing SSL certificates ==="
ls -la /etc/letsencrypt/live/ 2>/dev/null || echo "No certificates found"

echo ""
echo "=== Checking listening ports ==="
ss -tlnp | head -30

