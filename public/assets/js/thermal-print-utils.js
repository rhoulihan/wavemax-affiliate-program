// Thermal Printer Utilities for WaveMAX
// Supports ESC/POS commands for thermal label printers
(function() {
  'use strict';

  window.ThermalPrintUtils = {
    
    // Generate ESC/POS commands for bag labels
    generateThermalLabelCommands: function(labelData) {
      const commands = [];
      
      // Initialize printer
      commands.push('\x1B\x40'); // ESC @ - Initialize printer
      
      // Set print area width for 4" label (832 dots at 203 DPI)
      commands.push('\x1D\x57\x40\x03'); // GS W - Set print area width
      
      // For each label
      labelData.forEach((label, index) => {
        if (index > 0) {
          // Feed to next label
          commands.push('\x1B\x64\x05'); // ESC d - Feed n lines
        }
        
        // Center alignment
        commands.push('\x1B\x61\x01'); // ESC a - Center alignment
        
        // Large font for header
        commands.push('\x1D\x21\x11'); // GS ! - Double width and height
        commands.push('WaveMAX Laundry\n');
        
        // Normal font
        commands.push('\x1D\x21\x00'); // GS ! - Normal size
        commands.push(label.customerName + '\n\n');
        
        // Large font for bag info
        commands.push('\x1D\x21\x11'); // GS ! - Double width and height
        commands.push(`Bag ${label.bagNumber} of ${label.totalBags}\n\n`);
        
        // Generate QR code
        const qrData = label.qrCode;
        const qrSize = 8; // Size 1-16
        
        // QR Code commands
        commands.push('\x1D\x28\x6B\x04\x00\x31\x41\x32\x00'); // Model 2
        commands.push('\x1D\x28\x6B\x03\x00\x31\x43' + String.fromCharCode(qrSize)); // Size
        commands.push('\x1D\x28\x6B\x03\x00\x31\x45\x30'); // Error correction L
        
        // Store QR data
        const qrLength = qrData.length + 3;
        const pL = qrLength % 256;
        const pH = Math.floor(qrLength / 256);
        commands.push('\x1D\x28\x6B' + String.fromCharCode(pL) + String.fromCharCode(pH) + '\x31\x50\x30' + qrData);
        
        // Print QR code
        commands.push('\x1D\x28\x6B\x03\x00\x31\x51\x30');
        
        // Normal font for ID
        commands.push('\x1D\x21\x00'); // GS ! - Normal size
        commands.push('\n' + label.customerId + '\n');
        
        // Small font for footer
        commands.push('\x1B\x4D\x01'); // ESC M - Small font
        commands.push('Scan to process\n');
        commands.push(new Date().toLocaleDateString() + '\n');
        
        // Cut paper (partial cut)
        commands.push('\x1D\x56\x01'); // GS V - Partial cut
      });
      
      return commands.join('');
    },
    
    // Check if Web USB API is available
    isWebUSBAvailable: function() {
      return 'usb' in navigator;
    },
    
    // Print via Web USB API (Chrome Android)
    printViaWebUSB: async function(labelData) {
      if (!this.isWebUSBAvailable()) {
        throw new Error('Web USB API not available. Please use Chrome on Android.');
      }
      
      try {
        // Request USB device access
        const device = await navigator.usb.requestDevice({
          filters: [
            { vendorId: 0x0483 }, // Common thermal printer vendor IDs
            { vendorId: 0x0519 },
            { vendorId: 0x04b8 }, // Epson
            { vendorId: 0x0d87 }  // HP
          ]
        });
        
        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(0);
        
        // Generate ESC/POS commands
        const commands = this.generateThermalLabelCommands(labelData);
        const encoder = new TextEncoder();
        const data = encoder.encode(commands);
        
        // Send data to printer
        await device.transferOut(1, data);
        
        // Close device
        await device.close();
        
        return true;
      } catch (error) {
        console.error('WebUSB printing error:', error);
        throw error;
      }
    },
    
    // Alternative: Generate raw print file for download
    generateRawPrintFile: function(labelData) {
      const commands = this.generateThermalLabelCommands(labelData);
      const blob = new Blob([commands], { type: 'application/octet-stream' });
      const fileName = `thermal-labels-${Date.now()}.prn`;
      
      // Create download link
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      
      return true;
    }
  };
})();