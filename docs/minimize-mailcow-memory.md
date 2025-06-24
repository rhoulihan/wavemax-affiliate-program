# Minimizing Mailcow Memory Consumption

## Current Memory Usage

- **ClamAV**: 1.34GB (35% of system memory)
- **SOGo**: 262MB (6.7%)
- **rspamd**: 237MB (6.1%)
- **Ofelia**: 227MB (5.8%)
- **PHP-FPM**: 113MB (2.9%)

Total mailcow usage: ~2.2GB out of 3.8GB system memory

## Option 1: Disable ClamAV (Recommended for Most Users)

ClamAV is consuming the most memory. If you're not receiving emails from untrusted sources, you can safely disable it.

### Steps to disable ClamAV:

1. Edit the mailcow configuration:
```bash
sudo nano /opt/mailcow-dockerized/mailcow.conf
```

2. Change this line:
```
SKIP_CLAMD=n
```
to:
```
SKIP_CLAMD=y
```

3. Restart mailcow:
```bash
cd /opt/mailcow-dockerized
sudo docker-compose down
sudo docker-compose up -d
```

**Expected memory savings: ~1.34GB**

## Option 2: Optimize ClamAV (If You Need Antivirus)

If you need to keep ClamAV running, you can reduce its memory usage:

1. Edit ClamAV configuration:
```bash
sudo nano /opt/mailcow-dockerized/data/conf/clamav/clamd.conf
```

2. Add or modify these settings:
```
# Reduce concurrent threads
MaxThreads 5

# Reduce queue size
MaxQueue 40

# Disable some less critical features
HeuristicAlerts no
DetectPUA no
PhishingSignatures no
PhishingScanURLs no

# Reduce scan limits
MaxScanSize 25M
MaxFileSize 10M
```

3. Restart ClamAV:
```bash
cd /opt/mailcow-dockerized
sudo docker-compose restart clamd-mailcow
```

**Expected memory savings: ~200-400MB**

## Option 3: Disable SOGo Webmail (If Not Used)

If you're not using the SOGo webmail interface:

1. Edit mailcow configuration:
```bash
sudo nano /opt/mailcow-dockerized/mailcow.conf
```

2. Add this line:
```
SKIP_SOGO=y
```

3. Restart mailcow:
```bash
cd /opt/mailcow-dockerized
sudo docker-compose down
sudo docker-compose up -d
```

**Expected memory savings: ~262MB**

## Option 4: Reduce rspamd Workers

1. Create a custom rspamd configuration:
```bash
sudo nano /opt/mailcow-dockerized/data/conf/rspamd/local.d/worker-controller.inc
```

2. Add:
```
count = 1;
```

3. Do the same for normal worker:
```bash
sudo nano /opt/mailcow-dockerized/data/conf/rspamd/local.d/worker-normal.inc
```

4. Add:
```
count = 1;
```

5. Restart rspamd:
```bash
cd /opt/mailcow-dockerized
sudo docker-compose restart rspamd-mailcow
```

**Expected memory savings: ~50-100MB**

## Option 5: Add Swap Space (Recommended)

Adding swap will help manage memory pressure:

```bash
# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Adjust swappiness for server use
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## Recommended Actions

For a system primarily running the WaveMAX application with mailcow for email:

1. **Disable ClamAV** (saves 1.34GB)
2. **Add 2GB swap space** (provides buffer)
3. **Optionally disable SOGo** if webmail isn't needed (saves 262MB)

This would free up ~1.6GB of RAM and provide swap buffer, leaving plenty of memory for your application.

## Monitoring After Changes

Check memory usage after changes:
```bash
# Overall memory
free -h

# Docker container memory
docker stats --no-stream

# Check specific service is disabled
docker ps | grep clamd  # Should return nothing if disabled
```