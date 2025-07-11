// Deletion Status Page JavaScript
$(document).ready(function() {
    // Get confirmation code from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const confirmationCode = urlParams.get('code');

    if (!confirmationCode) {
        showError(window.i18next ? window.i18next.t('deletionStatus.error.noCode') : 'No confirmation code provided');
        return;
    }

    // Load the deletion status
    loadDeletionStatus(confirmationCode);
});

function loadDeletionStatus(code) {
    $('#loadingSection').show();
    $('#errorSection').hide();
    $('#statusSection').hide();

    $.ajax({
        url: `/api/v1/auth/facebook/deletion-status/${code}`,
        type: 'GET',
        success: function(data) {
            displayStatus(data);
        },
        error: function(xhr) {
            $('#loadingSection').hide();
            let errorMessage = window.i18next ? window.i18next.t('deletionStatus.error.loadFailed') : 'Failed to load deletion status';
            
            if (xhr.status === 404) {
                errorMessage = window.i18next ? window.i18next.t('deletionStatus.error.notFound') : 'Deletion request not found';
            } else if (xhr.responseJSON && xhr.responseJSON.error) {
                errorMessage = xhr.responseJSON.error;
            }
            
            showError(errorMessage);
        }
    });
}

function displayStatus(data) {
    $('#loadingSection').hide();
    $('#statusSection').show();

    // Set confirmation code
    $('#confirmationCode').text(data.confirmationCode);

    // Set status icon and title based on status
    const statusIcon = $('#statusIcon');
    const statusTitle = $('#statusTitle');
    
    switch (data.status) {
        case 'pending':
            statusIcon.html('<i class="fas fa-clock"></i>').removeClass().addClass('status-icon pending');
            statusTitle.text(window.i18next ? window.i18next.t('deletionStatus.status.pending') : 'Pending Processing');
            break;
        case 'processing':
            statusIcon.html('<i class="fas fa-spinner fa-spin"></i>').removeClass().addClass('status-icon processing');
            statusTitle.text(window.i18next ? window.i18next.t('deletionStatus.status.processing') : 'Currently Processing');
            break;
        case 'completed':
            statusIcon.html('<i class="fas fa-check-circle"></i>').removeClass().addClass('status-icon completed');
            statusTitle.text(window.i18next ? window.i18next.t('deletionStatus.status.completed') : 'Completed Successfully');
            break;
        case 'failed':
            statusIcon.html('<i class="fas fa-times-circle"></i>').removeClass().addClass('status-icon failed');
            statusTitle.text(window.i18next ? window.i18next.t('deletionStatus.status.failed') : 'Failed');
            break;
    }

    // Set status text
    $('#status').text(data.formattedStatus);

    // Format and set timestamps
    const requestedDate = new Date(data.requestedAt);
    $('#requestedAt').text(formatDateTime(requestedDate));

    if (data.completedAt) {
        const completedDate = new Date(data.completedAt);
        $('#completedAt').text(formatDateTime(completedDate));
        $('#completedRow').show();
    }

    // Show appropriate status message
    const statusMessage = $('#statusMessage');
    statusMessage.empty();

    if (data.status === 'completed' && data.deletionDetails) {
        const successMsg = $('<div class="success-message"></div>');
        successMsg.append(`<h4>${window.i18next ? window.i18next.t('deletionStatus.success.title') : 'Deletion Completed'}</h4>`);
        
        if (data.deletionDetails.completedActions && data.deletionDetails.completedActions.length > 0) {
            const actionsList = $('<ul></ul>');
            data.deletionDetails.completedActions.forEach(action => {
                actionsList.append(`<li>${action}</li>`);
            });
            successMsg.append(actionsList);
        }

        if (data.deletionDetails.dataDeleted && data.deletionDetails.dataDeleted.length > 0) {
            successMsg.append(`<p>${window.i18next ? window.i18next.t('deletionStatus.success.dataTypes') : 'Data types deleted:'} ${data.deletionDetails.dataDeleted.join(', ')}</p>`);
        }

        statusMessage.append(successMsg);
    } else if (data.status === 'failed' && data.errors) {
        const errorMsg = $('<div class="error-message"></div>');
        errorMsg.append(`<h4>${window.i18next ? window.i18next.t('deletionStatus.failed.title') : 'Deletion Failed'}</h4>`);
        
        if (data.errors.length > 0) {
            const errorList = $('<ul></ul>');
            data.errors.forEach(error => {
                errorList.append(`<li>${error}</li>`);
            });
            errorMsg.append(errorList);
        }
        
        errorMsg.append(`<p>${window.i18next ? window.i18next.t('deletionStatus.failed.contact') : 'Please contact support for assistance.'}</p>`);
        statusMessage.append(errorMsg);
    } else if (data.status === 'pending' || data.status === 'processing') {
        const infoMsg = $('<div class="info-message"></div>');
        infoMsg.append(`<p>${window.i18next ? window.i18next.t('deletionStatus.processing.message') : 'Your data deletion request is being processed. Please check back later for updates.'}</p>`);
        
        if (data.ageInHours > 24) {
            infoMsg.append(`<p>${window.i18next ? window.i18next.t('deletionStatus.processing.delayed') : 'Note: This request has been pending for over 24 hours. If you have concerns, please contact support.'}</p>`);
        }
        
        statusMessage.append(infoMsg);
    }
}

function showError(message) {
    $('#errorSection').show();
    $('#errorMessage').text(message);
}

function formatDateTime(date) {
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    // Use the current language if i18next is loaded
    const locale = window.i18next ? window.i18next.language : 'en';
    
    return date.toLocaleString(locale, options);
}