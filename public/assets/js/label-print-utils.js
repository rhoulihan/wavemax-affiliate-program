// Label Printing Utilities for WaveMAX
(function() {
  'use strict';

  // Export to window for global access
  window.LabelPrintUtils = {
    
    // Generate and print bag labels
    generateAndPrintBagLabels: async function(labelData) {
      // Check if jsPDF is available
      if (typeof window.jspdf === 'undefined') {
        console.error('jsPDF library not loaded');
        throw new Error('PDF generation library not loaded. Please refresh the page and try again.');
      }
      
      // Check if QRCode is available
      if (typeof QRCode === 'undefined') {
        console.error('QRCode library not loaded');
        throw new Error('QR Code library not loaded. Please refresh the page and try again.');
      }
      
      // Create new PDF with 4x6 inch dimensions (standard shipping label size)
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [4, 6]
      });
      
      let isFirstLabel = true;
      
      for (const label of labelData) {
        // Add new page for each label except the first
        if (!isFirstLabel) {
          pdf.addPage();
        }
        isFirstLabel = false;
        
        // Set margins and positions
        const margin = 0.375;
        const pageWidth = 4;
        const pageHeight = 6;
        const contentWidth = pageWidth - (margin * 2);
        
        // Add header
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text('WaveMAX Laundry', pageWidth / 2, margin + 0.3, { align: 'center' });
        
        // Add customer name
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'normal');
        pdf.text(label.customerName, pageWidth / 2, margin + 0.7, { align: 'center' });
        
        // Add bag info
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        const bagText = `Bag ${label.bagNumber} of ${label.totalBags}`;
        pdf.text(bagText, pageWidth / 2, margin + 1.2, { align: 'center' });
        
        // Generate QR code using the same method as admin dashboard
        let qrImageUrl;
        try {
          qrImageUrl = await QRCode.toDataURL(label.qrCode, {
            width: 200,
            margin: 1,
            errorCorrectionLevel: 'H',
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
        } catch (qrError) {
          console.error('QR Code generation error:', qrError);
          // Create a fallback placeholder if QR code fails
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 200;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#000';
          ctx.font = '20px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label.qrCode, 100, 100);
          qrImageUrl = canvas.toDataURL('image/png');
        }
        
        // Add QR code to PDF (centered)
        const qrSizeInInches = 2;
        const qrX = (pageWidth - qrSizeInInches) / 2;
        pdf.addImage(qrImageUrl, 'PNG', qrX, 2, qrSizeInInches, qrSizeInInches);
        
        // Add customer ID below QR code
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`ID: ${label.customerId}`, pageWidth / 2, 4.5, { align: 'center' });
        
        // Add instructions
        pdf.setFontSize(10);
        pdf.text('Scan this code to process this bag', pageWidth / 2, 5, { align: 'center' });
        
        // Add footer with date
        pdf.setFontSize(8);
        const printDate = new Date().toLocaleDateString();
        pdf.text(`Printed: ${printDate}`, pageWidth / 2, pageHeight - margin, { align: 'center' });
      }
      
      // For Android/mobile devices, offer download option
      const isAndroid = /android/i.test(navigator.userAgent);
      const isMobile = /mobile|tablet/i.test(navigator.userAgent);
      
      if (isAndroid || isMobile) {
        // On mobile devices, download the PDF for printing via appropriate app
        const pdfBlob = pdf.output('blob');
        const fileName = `bag-labels-${new Date().getTime()}.pdf`;
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(pdfBlob);
        downloadLink.download = fileName;
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Show instructions
        alert('Label PDF downloaded. Please open with a PDF viewer that supports printing to your thermal printer.');
      } else {
        // Desktop browser - open print dialog
        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const printWindow = window.open(pdfUrl);
        
        // Auto-print when loaded
        if (printWindow) {
          printWindow.onload = function() {
            printWindow.print();
          };
        }
      }
      
      return true;
    },
    
    // Generate and print customer cards (from admin dashboard)
    generateAndPrintCustomerCards: async function(customers) {
      // This is extracted from administrator-dashboard-init.js
      // Check if jsPDF is available
      if (typeof window.jspdf === 'undefined') {
        console.error('jsPDF library not loaded');
        throw new Error('PDF generation library not loaded. Please refresh the page and try again.');
      }
      
      // Create new PDF with 4x6 inch dimensions
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [4, 6]
      });
      
      let isFirstCard = true;
      
      for (const customer of customers) {
        // Add new page for each card except the first
        if (!isFirstCard) {
          pdf.addPage();
        }
        isFirstCard = false;
        
        // Set margins and positions
        const margin = 0.375;
        const pageWidth = 4;
        const pageHeight = 6;
        const contentWidth = pageWidth - (margin * 2);
        
        // Add header
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        pdf.text('WaveMAX Laundry', pageWidth / 2, margin + 0.5, { align: 'center' });
        
        // Add customer name
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'normal');
        const customerName = `${customer.firstName} ${customer.lastName}`;
        pdf.text(customerName, pageWidth / 2, margin + 1, { align: 'center' });
        
        // Generate QR code using the same method as admin dashboard
        let qrImageUrl;
        try {
          qrImageUrl = await QRCode.toDataURL(customer.customerId, {
            width: 256,
            margin: 1,
            errorCorrectionLevel: 'H',
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
        } catch (qrError) {
          console.error('QR Code generation error:', qrError);
          // Create a fallback placeholder if QR code fails
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#000';
          ctx.font = '20px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(customer.customerId, 128, 128);
          qrImageUrl = canvas.toDataURL('image/png');
        }
        
        // Add QR code to PDF (centered)
        const qrSizeInInches = 2.5;
        const qrX = (pageWidth - qrSizeInInches) / 2;
        pdf.addImage(qrImageUrl, 'PNG', qrX, 1.75, qrSizeInInches, qrSizeInInches);
        
        // Add customer ID
        pdf.setFontSize(14);
        pdf.setFont('courier', 'bold');
        pdf.text(`ID: ${customer.customerId}`, pageWidth / 2, 4.5, { align: 'center' });
        
        // Add customer details
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        
        let yPos = 5;
        const lineHeight = 0.2;
        
        // Phone
        if (customer.phone) {
          pdf.text(`Phone: ${customer.phone}`, pageWidth / 2, yPos, { align: 'center' });
          yPos += lineHeight;
        }
        
        // Number of bags
        if (customer.numberOfBags) {
          pdf.text(`Bags: ${customer.numberOfBags}`, pageWidth / 2, yPos, { align: 'center' });
          yPos += lineHeight;
        }
        
        // Service frequency
        if (customer.serviceFrequency) {
          const frequency = customer.serviceFrequency.charAt(0).toUpperCase() + customer.serviceFrequency.slice(1);
          pdf.text(`Service: ${frequency}`, pageWidth / 2, yPos, { align: 'center' });
          yPos += lineHeight;
        }
        
        // Add footer
        pdf.setFontSize(8);
        pdf.text('Scan this card at pickup', pageWidth / 2, pageHeight - margin - 0.2, { align: 'center' });
        
        // Registration date
        const regDate = new Date(customer.registrationDate).toLocaleDateString();
        pdf.text(`Member since: ${regDate}`, pageWidth / 2, pageHeight - margin, { align: 'center' });
      }
      
      // For Android/mobile devices, offer download option
      const isAndroid = /android/i.test(navigator.userAgent);
      const isMobile = /mobile|tablet/i.test(navigator.userAgent);
      
      if (isAndroid || isMobile) {
        // On mobile devices, download the PDF for printing via appropriate app
        const pdfBlob = pdf.output('blob');
        const fileName = `bag-labels-${new Date().getTime()}.pdf`;
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(pdfBlob);
        downloadLink.download = fileName;
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Show instructions
        alert('Label PDF downloaded. Please open with a PDF viewer that supports printing to your thermal printer.');
      } else {
        // Desktop browser - open print dialog
        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const printWindow = window.open(pdfUrl);
        
        // Auto-print when loaded
        if (printWindow) {
          printWindow.onload = function() {
            printWindow.print();
          };
        }
      }
      
      return true;
    }
  };
})();