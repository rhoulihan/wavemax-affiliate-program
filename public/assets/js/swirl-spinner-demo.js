// Demo functionality
const spinners = {};

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners for size toggle buttons
    document.getElementById('toggle-small')?.addEventListener('click', () => toggleSpinner('small'));
    document.getElementById('toggle-default')?.addEventListener('click', () => toggleSpinner('default'));
    document.getElementById('toggle-large')?.addEventListener('click', () => toggleSpinner('large'));
    
    // Add event listeners for speed toggle buttons
    document.getElementById('toggle-smooth')?.addEventListener('click', () => toggleSpeedSpinner('smooth'));
    document.getElementById('toggle-normal')?.addEventListener('click', () => toggleSpeedSpinner('normal'));
    document.getElementById('toggle-fast')?.addEventListener('click', () => toggleSpeedSpinner('fast'));
    
    // Add event listener for message spinner
    document.getElementById('toggle-message')?.addEventListener('click', toggleMessageSpinner);
    
    // Add event listeners for action buttons
    document.getElementById('save-button')?.addEventListener('click', simulateSave);
    document.getElementById('load-button')?.addEventListener('click', simulateLoad);
    document.getElementById('show-global')?.addEventListener('click', showGlobalSpinner);
    
    // Form demo event listener
    document.getElementById('demo-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const spinner = SwirlSpinnerUtils.showOnForm(this, {
            message: 'Submitting form...'
        });
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        spinner.hide();
        alert('Form submitted successfully!');
    });
});

function toggleSpinner(size) {
    const containerId = `${size}-spinner-container`;
    const container = document.getElementById(containerId);
    
    if (spinners[size]) {
        spinners[size].hide();
        spinners[size] = null;
    } else {
        spinners[size] = new SwirlSpinner({
            size: size,
            container: container
        }).show();
    }
}

function toggleSpeedSpinner(speed) {
    const container = document.getElementById(`${speed}-spinner-container`);
    
    if (spinners[speed]) {
        spinners[speed].hide();
        spinners[speed] = null;
    } else {
        spinners[speed] = new SwirlSpinner({
            speed: speed,
            container: container
        }).show();
    }
}

function toggleMessageSpinner() {
    const container = document.getElementById('message-spinner-container');
    
    if (spinners.message) {
        spinners.message.hide();
        spinners.message = null;
    } else {
        spinners.message = new SwirlSpinner({
            message: 'Loading your data...',
            container: container
        }).show();
    }
}

// Button demos
async function simulateSave() {
    const button = document.getElementById('save-button');
    const spinner = SwirlSpinnerUtils.showOnButton(button);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    spinner.hide();
    alert('Changes saved!');
}

async function simulateLoad() {
    const button = document.getElementById('load-button');
    const spinner = SwirlSpinnerUtils.showOnButton(button, { pulse: true });
    
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    spinner.hide();
    alert('Data loaded!');
}

function showGlobalSpinner() {
    const spinner = SwirlSpinnerUtils.showGlobal({
        message: 'Please wait while we process your request...'
    });
    
    setTimeout(() => {
        spinner.hide();
        alert('Process completed!');
    }, 3000);
}