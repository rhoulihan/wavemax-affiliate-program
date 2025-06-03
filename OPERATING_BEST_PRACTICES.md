# WaveMAX Development Operating Best Practices

This document contains important operational knowledge and workarounds discovered during development sessions.

## PM2 and Logging

### ❌ Known Issues
1. **PM2 logs command timeout**: The command `pm2 logs wavemax --lines 50` frequently times out
   - **Issue**: Command hangs and requires user interruption
   - **Discovered**: 2025-01-06

### ✅ Alternative Approaches
1. **For viewing recent logs**:
   ```bash
   # Option 1: Check PM2 log files directly
   tail -n 50 /root/.pm2/logs/wavemax-error.log
   tail -n 50 /root/.pm2/logs/wavemax-out.log
   
   # Option 2: Use PM2 logs without line limit
   pm2 logs wavemax --nostream
   
   # Option 3: Check specific error instance
   pm2 describe wavemax
   ```

2. **For debugging startup issues**:
   ```bash
   # Check if app is running
   pm2 status
   
   # Get detailed info about the app
   pm2 describe wavemax
   
   # Start in no-daemon mode to see real-time output
   pm2 start server.js --no-daemon
   ```

## Common Debugging Patterns

### Application Won't Start (502 Bad Gateway)
1. Check PM2 status: `pm2 status`
2. If status shows "errored", check logs directly: 
   - `tail -n 100 /root/.pm2/logs/wavemax-error-*.log`
   - Note: Log file numbers increase with restarts (e.g., wavemax-error-7.log)
3. **Best approach**: Start manually to see error: 
   ```bash
   pm2 stop wavemax
   node server.js
   ```
4. Common causes:
   - Syntax errors in recently modified files
   - Missing required environment variables
   - Port already in use
   - MongoDB connection issues
   - **Incorrect middleware imports** (e.g., using `verifyRole` instead of `checkRole` from rbac.js)

### CSRF Token Issues
- Multiple CSRF validation failures in logs are often from bots/scanners
- Can be safely ignored unless affecting legitimate functionality

## Testing Best Practices

### Running Tests
1. **Memory issues**: Use `npm run test:memory` instead of `npm test` for large test suites
2. **Individual test files**: `npm test -- path/to/test.js`
3. **Watch for hanging tests**: Use `--detectOpenHandles` flag

## Git Workflow

### Before Major Changes
1. Always check `git status` first
2. Review uncommitted changes to determine if they should be:
   - Committed as part of current work
   - Stashed for later
   - Discarded if experimental

## Session Management

### Project Logs
- Always update status in project logs when switching between tasks
- Use clear status indicators: IN PROGRESS, TESTING, COMPLETED, BLOCKED

### Backlog Management
- Add discovered issues to BACKLOG.md immediately
- Include context about when/how the issue was discovered

## Environment-Specific Notes

### Production Deployment
- Always run `pm2 restart wavemax` after code changes
- Use `pm2 restart wavemax --update-env` if environment variables changed

### Development vs Production
- Check NODE_ENV setting when debugging environment-specific issues
- Some features (like documentation) may be environment-gated

---

*Last Updated: 2025-01-06*