#!/bin/bash
# Script to rotate critical credentials in .env file

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== WaveMAX Credential Rotation Script ===${NC}"
echo -e "${RED}WARNING: This will rotate ALL critical security credentials${NC}"
echo -e "${RED}Make sure to update production servers after running this script!${NC}"
echo

# Backup current .env
BACKUP_FILE=".env.backup.$(date +%Y%m%d_%H%M%S)"
cp .env "$BACKUP_FILE"
echo -e "${GREEN}✓ Backed up current .env to: $BACKUP_FILE${NC}"

# Generate new secure keys
echo -e "\n${YELLOW}Generating new secure keys...${NC}"
NEW_JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
NEW_ENCRYPTION_KEY=$(openssl rand -hex 32)
NEW_SESSION_SECRET=$(openssl rand -base64 32 | tr -d '\n')
NEW_CSRF_SECRET=$(openssl rand -base64 32 | tr -d '\n')
NEW_DOCUSIGN_WEBHOOK_SECRET=$(openssl rand -base64 32 | tr -d '\n')

# Create temporary file with new credentials
TEMP_ENV=$(mktemp)

# Read the current .env and replace sensitive values
while IFS= read -r line; do
    if [[ $line =~ ^JWT_SECRET= ]]; then
        echo "JWT_SECRET=$NEW_JWT_SECRET"
    elif [[ $line =~ ^ENCRYPTION_KEY= ]]; then
        echo "ENCRYPTION_KEY=$NEW_ENCRYPTION_KEY"
    elif [[ $line =~ ^SESSION_SECRET= ]]; then
        echo "SESSION_SECRET=$NEW_SESSION_SECRET"
    elif [[ $line =~ ^CSRF_SECRET= ]]; then
        echo "CSRF_SECRET=$NEW_CSRF_SECRET"
    elif [[ $line =~ ^DOCUSIGN_WEBHOOK_SECRET= ]]; then
        echo "DOCUSIGN_WEBHOOK_SECRET=$NEW_DOCUSIGN_WEBHOOK_SECRET"
    else
        echo "$line"
    fi
done < .env > "$TEMP_ENV"

# Check if CSRF_SECRET exists, if not add it
if ! grep -q "^CSRF_SECRET=" "$TEMP_ENV"; then
    # Add after SESSION_SECRET
    sed -i "/^SESSION_SECRET=/a CSRF_SECRET=$NEW_CSRF_SECRET" "$TEMP_ENV"
fi

# Move the new file to .env
mv "$TEMP_ENV" .env
chmod 600 .env

echo -e "\n${GREEN}✓ Successfully rotated the following credentials:${NC}"
echo "  - JWT_SECRET"
echo "  - ENCRYPTION_KEY"
echo "  - SESSION_SECRET"
echo "  - CSRF_SECRET"
echo "  - DOCUSIGN_WEBHOOK_SECRET"

echo -e "\n${YELLOW}IMPORTANT NEXT STEPS:${NC}"
echo "1. Update these credentials on the production server"
echo "2. Restart the application with: pm2 restart wavemax --update-env"
echo "3. Test that the application is working correctly"
echo "4. Update any external services that use these keys"

echo -e "\n${RED}WARNING: The following credentials still need manual rotation:${NC}"
echo "  - MongoDB password (in MongoDB Atlas)"
echo "  - Email service password"
echo "  - OAuth client secrets (Google, Facebook, LinkedIn)"
echo "  - DocuSign integration key and private key"
echo "  - Paygistix credentials"

echo -e "\n${GREEN}Script completed. Old credentials backed up to: $BACKUP_FILE${NC}"